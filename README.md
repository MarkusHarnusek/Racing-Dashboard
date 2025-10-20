# RacingDash

RacingDash is a dynamic and responsive dashboard designed for racing simulations. It provides real-time updates and visual indicators to enhance the racing experience.

## Features

- **Dynamic Font Scaling**: Uses `clamp()` for responsive font sizes.
- **Flag Indicators**: Displays flashing side dots for different racing flags.
- **Customizable Styles**: Easily modify the appearance using CSS.
- **Responsive Design**: Adapts to various screen sizes.

## File Structure

```
RacingDash/
├── index.html       # Main HTML file
├── script.js        # JavaScript logic for the dashboard
├── styles.css       # Styling for the dashboard
└── README.md        # Project documentation
```

## Usage

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Open `index.html` in your browser to view the dashboard.

3. Customize the styles in `styles.css` or the logic in `script.js` as needed.

## Development

### Prerequisites
- A modern web browser (e.g., Chrome, Firefox).
- A code editor (e.g., VS Code).

### Editing the Code
- Modify `script.js` for logic changes.
- Update `styles.css` for design changes.

### Debugging
Use browser developer tools to inspect elements and debug JavaScript.

## Backend Integration

RacingDash integrates seamlessly with the [**USRTG Server**](https://github.com/MarkusHarnusek/USRTG) (Unified Sim Racing Telemetry Getter) to fetch real-time telemetry data from supported racing games. The backend server ensures efficient and reliable data handling, making it an essential component of the dashboard.

### USRTG Server Overview

The USRTG Server is a .NET-based application designed to handle network communication and packet processing. It supports real-time telemetry data collection from games like **Assetto Corsa**.

### Key Features of USRTG Server
- **Real-Time Telemetry**: Collects and broadcasts telemetry data in real-time.
- **Supported Games**: Assetto Corsa and more.
- **Efficient Data Handling**: Built using modern .NET technologies for scalability and reliability.

### How RacingDash Uses USRTG
- **Data Source**: Fetches live telemetry data from the USRTG Server endpoint.
- **Visualization**: Displays the data in an intuitive and user-friendly format on the dashboard.
- **Custom Fetching**: Supports customizable fetch intervals and error handling.

### Utility Script: `getCurrentData.js`

RacingDash includes a browser-based utility script, `getCurrentData.js`, to fetch and display live data from the USRTG Server.

#### Features
- **Live Fetch Panel**: Displays a floating panel in the browser for fetching data from the endpoint `http://10.214.10.8:8080/packet`.
- **Customizable Interval**: Allows users to set the fetch interval (default is 2000ms).
- **Start/Stop Controls**: Provides buttons to start and stop the live data fetching process.
- **Error Handling**: Logs errors and implements an exponential backoff mechanism for retrying failed requests.
- **Output Display**: Shows the fetched data and logs in a user-friendly format.

#### How to Use
1. Include the script in your browser environment.
2. Open the browser console and execute the script.
3. A floating panel will appear in the top-right corner of the browser window.
4. Use the `Start` button to begin fetching data and the `Stop` button to halt the process.
5. Adjust the fetch interval using the input field provided in the panel.

#### Notes
- Ensure that the server at `http://10.214.10.8:8080/packet` is accessible and allows cross-origin requests (CORS).
- Press the `✕` button or the `Escape` key to close the panel.