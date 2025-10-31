const DEFAULT_COLOR = "#555555";
const BRIGHT_COLORS = [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#00ffff",
    "#be00beff",
    "#ffffff",
];

const left_plus = document.getElementById("left-plus");
const right_plus = document.getElementById("right-plus");
const left_minus = document.getElementById("left-minus");
const right_minus = document.getElementById("right-minus");
const left_container_title = document.getElementById("container-left-title");
const right_container_title = document.getElementById("container-right-title");

const LEFT_PAGES = [
    "Timing",
    "Fuel",
    "Tyres",
    "Session",
    "Car",
    "Input",
    "Environment",
    "Sectors",
    "Delta",
];

let currentLeftPageIndex = 0;

const RIGHT_PAGES = [
    "Timing",
    "Fuel",
    "Tyres",
    "Session",
    "Car",
    "Input",
    "Environment",
    "Sectors",
    "Delta",
];

let currentRightPageIndex = 0;

let previousFlagState = 0;
let flashGreen = 0;
let greenFlashInterval = null;
let flagFlashInterval = null;
let flagFlashState = false;
let lastSectorCount = 1;
let lastSectorTimes = [];

function setDotColor(dotId, color) {
    const dot = document.getElementById(dotId);
    if (dot) {
        dot.style.backgroundColor = color;
        dot.style.color = color;

        if (color.toLowerCase() !== DEFAULT_COLOR.toLowerCase()) {
            dot.classList.add("active");

            if (BRIGHT_COLORS.includes(color.toLowerCase())) {
                dot.classList.add("bright");
            } else {
                dot.classList.remove("bright");
            }
        } else {
            dot.classList.remove("active", "bright");
        }
    }
}

function setAllDotsColor(color) {
    for (let i = 1; i <= 12; i++) {
        setDotColor(`d${i}`, color);
    }
}

function resetDots() {
    for (let i = 1; i <= 12; i++) {
        const dot = document.getElementById(`d${i}`);
        if (dot) {
            dot.style.backgroundColor = DEFAULT_COLOR;
            dot.style.color = DEFAULT_COLOR;
            dot.classList.remove("active", "bright");
        }
    }
}

function setSideDotColor(side, position, color) {
    const dotId = `${side}Dot${position}`;
    setDotColor(dotId, color);
}

function setLeftDotColor(position, color) {
    setSideDotColor("left", position, color);
}

function setRightDotColor(position, color) {
    setSideDotColor("right", position, color);
}

function setSideDotsPair(position, color) {
    setLeftDotColor(position, color);
    setRightDotColor(position, color);
}

function resetSideDots() {
    for (let i = 1; i <= 3; i++) {
        setLeftDotColor(i, DEFAULT_COLOR);
        setRightDotColor(i, DEFAULT_COLOR);
    }
}

function resetAllDots() {
    resetDots();
    resetSideDots();
}

let latestPacketData = null;
let flashState = false;
let flashInterval = null;
let pitFlashState = false;
let pitFlashInterval = null;

const INPUT_HISTORY_LENGTH = 100;
let gasHistory = new Array(INPUT_HISTORY_LENGTH).fill(0);
let brakeHistory = new Array(INPUT_HISTORY_LENGTH).fill(0);

async function fetchPacketData() {
    try {
        const response = await fetch("http://192.168.33.120:8080/packet", {
            method: "GET",
            mode: "cors",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const packetData = await response.json();
        latestPacketData = packetData;

        processPacketData(packetData);

        return packetData;
    } catch (error) {
        console.error("Error fetching packet data:", error);
        if (Math.random() < 0.01) {
            console.warn(
                "CORS error persisting. Consider using a local server or proxy."
            );
        }
        return null;
    }
}

function processPacketData(data) {
    if (!data) {
        return;
    }
    updateDashboardFromPacket(data);
}

function updateDashboardFromPacket(packet) {
    // Rpm dots
    const maxRpm = packet.maxRpm;
    const rpmPercentage = Math.min(packet.rpms / maxRpm, 1);
    const activeDots = Math.floor(rpmPercentage * 1.2 * 12);
    const isInFlashZone = rpmPercentage >= 0.95;

    if (isInFlashZone && !flashInterval) {
        startRpmFlashing(activeDots);
    } else if (!isInFlashZone && flashInterval) {
        stopRpmFlashing();
    }

    if (!flashInterval) {
        resetDots();

        for (let i = 1; i <= activeDots; i++) {
            let color = BRIGHT_COLORS[1];
            if (i > 8) {
                color = BRIGHT_COLORS[0];
            } else if (i > 4) {
                color = BRIGHT_COLORS[3];
            }

            setDotColor(`d${i}`, color);
        }
    }

    // Pit limiter
    let inPit = packet.isInPit == 1 || packet.isInPitLane == 1;

    if (inPit && !pitFlashInterval) {
        startPitFlashing();
    } else if (!inPit && pitFlashInterval) {
        stopPitFlashing();
    }

    // Flags
    if (packet.flag == 2 && previousFlagState != 2) {
        previousFlagState = 2;
        stopSynchronousSideDotFlashing();
        stopGreenFlashSequence();
        startSynchronousSideDotFlashing(BRIGHT_COLORS[3]);
    } else if (packet.flag == 7 && previousFlagState != 7 && packet.flag != 2) {
        previousFlagState = 7;
        stopSynchronousSideDotFlashing();
        stopGreenFlashSequence();
        startSynchronousSideDotFlashing(BRIGHT_COLORS[2]);
    } else if (packet.flag == 0 && previousFlagState == 2) {
        previousFlagState = 0;
        stopSynchronousSideDotFlashing();
        startGreenFlashSequence();
    } else if (
        packet.flag == 0 &&
        previousFlagState != 0 &&
        previousFlagState != 2
    ) {
        previousFlagState = 0;
        stopSynchronousSideDotFlashing();
        stopGreenFlashSequence();
    }

    // Gear display
    const gearElement = document.getElementById("gear-display");
    if (gearElement) {
        if (packet.gear == 0) {
            gearElement.textContent = "R";
        } else if (packet.gear == 1) {
            gearElement.textContent = "N";
        } else {
            gearElement.textContent = (packet.gear - 1).toString();
        }
    }

    // Speed display
    const speedElement = document.getElementById("speed-display");
    if (speedElement) {
        speedElement.textContent = Math.round(packet.speedKmh);
    }

    // Top container
    const tcElement = document.getElementById("tc-element");
    if (tcElement) {
        tcElement.textContent = packet.tc;
    }

    const absElement = document.getElementById("abs-element");
    if (absElement) {
        absElement.textContent = packet.abs;
    }

    const lapElement = document.getElementById("lap-element");
    if (lapElement) {
        lapElement.textContent = packet.completedLaps + 1;
    }

    const posElement = document.getElementById("pos-element");
    if (posElement) {
        posElement.textContent = packet.position;
    }

    // Time container
    const timeLeftElement = document.getElementById("timing-left");
    const timeRightElement = document.getElementById("timing-right");
    if (timeLeftElement && timeRightElement) {
        const currentLeft = document.getElementById("timing-current-left");
        const lastLeft = document.getElementById("timing-last-left");
        const bestLeft = document.getElementById("timing-best-left");

        const currentRight = document.getElementById("timing-current-right");
        const lastRight = document.getElementById("timing-last-right");
        const bestRight = document.getElementById("timing-best-right");

        if (
            currentLeft &&
            lastLeft &&
            bestLeft &&
            currentRight &&
            lastRight &&
            bestRight
        ) {
            currentLeft.textContent = formatTime(packet.currentTime);
            lastLeft.textContent = formatTime(packet.lastTime);
            bestLeft.textContent = formatTime(packet.bestTime);
            currentRight.textContent = formatTime(packet.currentTime);
            lastRight.textContent = formatTime(packet.lastTime);
            bestRight.textContent = formatTime(packet.bestTime);
        }
    }

    // Fuel container
    const fuelFullLeft = document.getElementById("fuel-full-left");
    const fuelFullRight = document.getElementById("fuel-full-right");
    const fuelBarLeft = document.getElementById("fuel-bar-left");
    const fuelBarRight = document.getElementById("fuel-bar-right");
    
    if (fuelFullLeft && fuelFullRight) {
        fuelFullLeft.textContent = `${packet.fuel.toFixed(1)}`;
        fuelFullRight.textContent = `${packet.fuel.toFixed(1)}`;
    }

    if (fuelBarLeft && fuelBarRight && packet.maxFuel > 0) {
        const fuelPercent = (packet.fuel / packet.maxFuel) * 100;
        fuelBarLeft.style.width = `${fuelPercent}%`;
        fuelBarRight.style.width = `${fuelPercent}%`;
        
        let barColor;
        if (fuelPercent > 20) {
            barColor = '#ececec';
        } else if (fuelPercent > 10) {
            const ratio = (fuelPercent - 10) / 5;
            const red = 255;
            const green = 255;
            const blue = Math.round(255 * ratio);
            barColor = `rgb(${red}, ${green}, ${blue})`;
        } else if (fuelPercent > 5) {
            const ratio = (fuelPercent - 5) / 5;
            const red = 255;
            const green = Math.round(255 * ratio);
            barColor = `rgb(${red}, ${green}, 0)`;
        } else {
            barColor = '#ff0000';
        }
        
        fuelBarLeft.style.backgroundColor = barColor;
        fuelBarRight.style.backgroundColor = barColor;
    }

    // Car container - Heading, Pitch, Roll
    const headingLeft = document.getElementById("heading-left");
    const headingRight = document.getElementById("heading-right");
    const pitchLeft = document.getElementById("pitch-left");
    const pitchRight = document.getElementById("pitch-right");
    const rollLeft = document.getElementById("roll-left");
    const rollRight = document.getElementById("roll-right");
    const compassLeft = document.getElementById("compass-left");
    const compassRight = document.getElementById("compass-right");

    if (packet.heading < 0)  {
        packet.heading += 360;
    } else if (packet.heading >= 360) {
        packet.heading -= 360;
    }

    if (headingLeft && headingRight) {
        headingLeft.textContent = `${packet.heading.toFixed(0)}°`;
        headingRight.textContent = `${packet.heading.toFixed(0)}°`;
    }

    if (compassLeft) {
        const dialLeft = compassLeft.querySelector('.compass-dial');
        if (dialLeft) {
            dialLeft.setAttribute('transform', `rotate(${-packet.heading} 50 50)`);
        }
    }

    if (compassRight) {
        const dialRight = compassRight.querySelector('.compass-dial');
        if (dialRight) {
            dialRight.setAttribute('transform', `rotate(${-packet.heading} 50 50)`);
        }
    }

    if (pitchLeft && pitchRight) {
        pitchLeft.textContent = `${packet.pitch.toFixed(2)}°`;
        pitchRight.textContent = `${packet.pitch.toFixed(2)}°`;
    }

    if (rollLeft && rollRight) {
        rollLeft.textContent = `${packet.roll.toFixed(2)}°`;
        rollRight.textContent = `${packet.roll.toFixed(2)}°`;
    }

    // Input container - Steer, Gas, Brake
    const steerLeft = document.getElementById("steer-left");
    const steerRight = document.getElementById("steer-right");
    const gasLeft = document.getElementById("gas-left");
    const gasRight = document.getElementById("gas-right");
    const brakeLeft = document.getElementById("brake-left");
    const brakeRight = document.getElementById("brake-right");
    const steeringWheelLeft = document.getElementById("steering-wheel-left");
    const steeringWheelRight = document.getElementById("steering-wheel-right");

    if (steerLeft && steerRight) {
        steerLeft.textContent = `${packet.steerAngle.toFixed(0)}°`;
        steerRight.textContent = `${packet.steerAngle.toFixed(0)}°`;
    }

    if (steeringWheelLeft) {
        steeringWheelLeft.style.transform = `rotate(${packet.steerAngle.toFixed(2)}deg)`;
    }

    if (steeringWheelRight) {
        steeringWheelRight.style.transform = `rotate(${packet.steerAngle.toFixed(2)}deg)`;
    }

    if (gasLeft && gasRight) {
        gasLeft.textContent = `${(packet.gas * 100).toFixed(0)}%`;
        gasRight.textContent = `${(packet.gas * 100).toFixed(0)}%`;
    }

    if (brakeLeft && brakeRight) {
        brakeLeft.textContent = `${(packet.brake * 100).toFixed(0)}%`;
        brakeRight.textContent = `${(packet.brake * 100).toFixed(0)}%`;
    }

    // Update input history
    gasHistory.shift();
    gasHistory.push(packet.gas);
    brakeHistory.shift();
    brakeHistory.push(packet.brake);

    // Draw input graphs
    drawInputGraph('input-graph-left', gasHistory, brakeHistory);
    drawInputGraph('input-graph-right', gasHistory, brakeHistory);
}

function startRpmFlashing(activeDots) {
    flashInterval = setInterval(() => {
        flashState = !flashState;

        if (flashState) {
            resetDots();
            for (let i = 1; i <= activeDots; i++) {
                let color = BRIGHT_COLORS[1];
                if (i > 8) {
                    color = BRIGHT_COLORS[0];
                } else if (i > 4) {
                    color = BRIGHT_COLORS[3];
                }
                setDotColor(`d${i}`, color);
            }
        } else {
            resetDots();
        }
    }, 100);
}

function stopRpmFlashing() {
    if (flashInterval) {
        clearInterval(flashInterval);
        flashInterval = null;
        flashState = false;
    }
}

function startPitFlashing() {
    pitFlashInterval = setInterval(() => {
        pitFlashState = !pitFlashState;

        resetSideDots();

        if (pitFlashState) {
            for (let i = 1; i <= 3; i++) {
                setLeftDotColor(i, "blue");
            }
        } else {
            for (let i = 1; i <= 3; i++) {
                setRightDotColor(i, "blue");
            }
        }
    }, 500);
}

function stopPitFlashing() {
    if (pitFlashInterval) {
        clearInterval(pitFlashInterval);
        pitFlashInterval = null;
        pitFlashState = false;
    }
    resetSideDots();
}

function startSynchronousSideDotFlashing(color) {
    if (flagFlashInterval) {
        clearInterval(flagFlashInterval);
    }

    flagFlashInterval = setInterval(() => {
        flagFlashState = !flagFlashState;

        if (flagFlashState) {
            for (let i = 1; i <= 3; i++) {
                setSideDotsPair(i, color);
            }
        } else {
            resetSideDots();
        }
    }, 250);
}

function stopSynchronousSideDotFlashing() {
    if (flagFlashInterval) {
        clearInterval(flagFlashInterval);
        flagFlashInterval = null;
        flagFlashState = false;
    }
    resetSideDots();
}

function startGreenFlashSequence() {
    let flashCount = 0;
    const maxFlashes = 3;
    let isOn = false;

    if (greenFlashInterval) {
        clearInterval(greenFlashInterval);
    }

    greenFlashInterval = setInterval(() => {
        isOn = !isOn;

        if (isOn) {
            for (let i = 1; i <= 3; i++) {
                setSideDotsPair(i, BRIGHT_COLORS[1]);
            }
        } else {
            resetSideDots();
            flashCount++;

            if (flashCount >= maxFlashes) {
                clearInterval(greenFlashInterval);
                greenFlashInterval = null;
                resetSideDots();
            }
        }
    }, 200);
}

function stopGreenFlashSequence() {
    if (greenFlashInterval) {
        clearInterval(greenFlashInterval);
        greenFlashInterval = null;
        resetSideDots();
    }
}

function startDataFetching() {
    setInterval(fetchPacketData, 10);
}

// Container cycle
left_plus.addEventListener("click", () => {
    currentLeftPageIndex++;
    currentLeftPageIndex %= LEFT_PAGES.length;
    updateContainerTitles();
    updateContainerVisibility();
    console.log(
        "Left plus clicked, new page:",
        LEFT_PAGES[currentLeftPageIndex]
    );
});

right_plus.addEventListener("click", () => {
    currentRightPageIndex++;
    currentRightPageIndex %= RIGHT_PAGES.length;
    updateContainerTitles();
    updateContainerVisibility();
    console.log(
        "Right plus clicked, new page:",
        RIGHT_PAGES[currentRightPageIndex]
    );
});

left_minus.addEventListener("click", () => {
    currentLeftPageIndex--;
    if (currentLeftPageIndex < 0) {
        currentLeftPageIndex = LEFT_PAGES.length - 1;
    }
    updateContainerTitles();
    updateContainerVisibility();
    console.log(
        "Left minus clicked, new page:",
        LEFT_PAGES[currentLeftPageIndex]
    );
});

right_minus.addEventListener("click", () => {
    currentRightPageIndex--;
    if (currentRightPageIndex < 0) {
        currentRightPageIndex = RIGHT_PAGES.length - 1;
    }
    updateContainerTitles();
    updateContainerVisibility();
    console.log(
        "Right minus clicked, new page:",
        RIGHT_PAGES[currentRightPageIndex]
    );
});

function updateContainerTitles() {
    left_container_title.textContent = LEFT_PAGES[currentLeftPageIndex];
    right_container_title.textContent = RIGHT_PAGES[currentRightPageIndex];
}

// Update visible containers
function updateContainerVisibility() {
    resetContainerVisibility();

    // Left container
    switch (LEFT_PAGES[currentLeftPageIndex]) {
        case "Timing":
            document.querySelector("#timing-left").style.display = "block";
            break;

        case "Fuel":
            document.querySelector("#fuel-left").style.display = "block";
            break;

        case "Tyres":
            document.querySelector("#tyres-left").style.display = "block";
            break;

        case "Session":
            document.querySelector("#session-left").style.display = "block";
            break;

        case "Car":
            document.querySelector("#car-left").style.display = "block";
            break;

        case "Input":
            document.querySelector("#input-left").style.display = "flex";
            break;

        case "Environment":
            document.querySelector("#environment-left").style.display = "block";
            break;

        case "Sectors":
            document.querySelector("#sectors-left").style.display = "block";
            break;

        case "Delta":
            document.querySelector("#delta-left").style.display = "block";
            break;
    }

    // Right container
    switch (RIGHT_PAGES[currentRightPageIndex]) {
        case "Timing":
            document.querySelector("#timing-right").style.display = "block";
            break;

        case "Fuel":
            document.querySelector("#fuel-right").style.display = "block";
            break;

            case "Tyres":
            document.querySelector("#tyres-right").style.display = "block";
            break;

        case "Session":
            document.querySelector("#session-right").style.display = "block";
            break;

        case "Car":
            document.querySelector("#car-right").style.display = "block";
            break;

        case "Input":
            document.querySelector("#input-right").style.display = "flex";
            break;

        case "Environment":
            document.querySelector("#environment-right").style.display = "block";
            break;

        case "Sectors":
            document.querySelector("#sectors-right").style.display = "block";
            break;

        case "Delta":
            document.querySelector("#delta-right").style.display = "block";
            break;
    }
}

// Reset all container visibility
function resetContainerVisibility() {
    const leftContainers = document.querySelectorAll(
        "#left-container-items > div"
    );
    leftContainers.forEach((container) => {
        container.style.display = "none";
    });

    const rightContainers = document.querySelectorAll(
        "#right-container-items > div"
    );
    rightContainers.forEach((container) => {
        container.style.display = "none";
    });
}

function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    // Only show minutes if they are greater than 0
    if (minutes > 0) {
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
            2,
            "0"
        )}.${String(milliseconds).padStart(3, "0")}`;
    } else {
        return `${String(seconds).padStart(2, "0")}.${String(
            milliseconds
        ).padStart(3, "0")}`;
    }
}

function drawInputGraph(canvasId, gasData, brakeData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < brakeData.length; i++) {
        const x = (width / (brakeData.length - 1)) * i;
        const y = height - (brakeData[i] * height);
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();

    // Draw gas line (green)
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < gasData.length; i++) {
        const x = (width / (gasData.length - 1)) * i;
        const y = height - (gasData[i] * height);
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

document.addEventListener("DOMContentLoaded", () => {
    setAllDotsColor(BRIGHT_COLORS[0]);
    updateContainerTitles();
    updateContainerVisibility();
    startDataFetching();
});
