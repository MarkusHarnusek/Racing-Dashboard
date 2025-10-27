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

async function fetchPacketData() {
    try {
        const response = await fetch("http://172.17.192.1:8080/packet", {
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
    } else if (packet.flag == 1 && previousFlagState != 1 && packet.flag != 2) {
        previousFlagState = 1;
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
        console.log(packet.speedKmh);
        speedElement.textContent = Math.round(packet.speedKmh);
    }

    // Top container
    const tcElement = document.getElementById("tc-element");
    if (tcElement) {
        tcElement.textContent = packet.tc;
    }
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
    console.log("Left plus clicked, new page:", LEFT_PAGES[currentLeftPageIndex]);
});

right_plus.addEventListener("click", () => {
    currentRightPageIndex++;
    currentRightPageIndex %= RIGHT_PAGES.length;
    updateContainerTitles();
    console.log("Right plus clicked, new page:", RIGHT_PAGES[currentRightPageIndex]);
});

left_minus.addEventListener("click", () => {
    currentLeftPageIndex--;
    if (currentLeftPageIndex < 0) {
        currentLeftPageIndex = LEFT_PAGES.length - 1;
    }
    updateContainerTitles();
    console.log("Left minus clicked, new page:", LEFT_PAGES[currentLeftPageIndex]);
});

right_minus.addEventListener("click", () => {
    currentRightPageIndex--;
    if (currentRightPageIndex < 0) {
        currentRightPageIndex = RIGHT_PAGES.length - 1;
    }
    updateContainerTitles();
    console.log("Right minus clicked, new page:", RIGHT_PAGES[currentRightPageIndex]);
});

function updateContainerTitles() {
    left_container_title.textContent = LEFT_PAGES[currentLeftPageIndex];
    right_container_title.textContent = RIGHT_PAGES[currentRightPageIndex];
}

document.addEventListener("DOMContentLoaded", () => {
    setAllDotsColor(BRIGHT_COLORS[0]);
    updateContainerTitles();
    startDataFetching();
});