# Battery Monitor

A modern, real-time battery monitoring interface for serial-connected battery readers. Built with vanilla JavaScript, Chart.js, and the Web Serial API.

## Features

- **Real-time monitoring** - Live voltage readings from serial port
- **Individual cell tracking** - Monitor each cell voltage independently
- **Historical charts** - Visualize voltage trends over time with Chart.js
- **Module details** - View raw ADC values and pin configurations
- **Dark mode** - GitHub Primer-inspired dark theme
- **Responsive design** - Works on desktop and mobile devices
- **Clean architecture** - Modular, maintainable code structure

## Requirements

- **Browser**: Chrome or Edge (Web Serial API support required)
- **Connection**: USB serial connection to battery reader
- **Baud rate**: 115200 (configurable in `serial-reader.js:54`)

## Installation

1. Clone or download this repository
2. Serve the files using a local web server (required for ES6 modules)

```bash
npx serve
```

### Option 2: Using VS Code
Install the "Live Server" extension and click "Go Live"

3. Open `http://localhost:8000` in Chrome or Edge

## Usage

1. Click the **Connect** button
2. Select your serial port from the browser dialog
3. Watch real-time data appear on the dashboard

### Keyboard Shortcuts
- `Ctrl/Cmd + K` - Toggle connection
- `Ctrl/Cmd + L` - Clear chart

## Architecture

The application is built with a clean, modular architecture:

### Modules

**`serial-reader.js`**
- Manages Web Serial API connection
- Handles data streaming and buffering
- Provides callbacks for data and status updates

**`battery-parser.js`**
- Parses raw serial data into structured format
- Calculates individual cell voltages
- Determines cell health status
- Provides export functionality (JSON/CSV)

**`chart-manager.js`**
- Manages Chart.js instance
- Handles real-time chart updates
- Implements dark theme styling
- Maintains rolling data window

**`app.js`**
- Orchestrates all modules
- Manages UI updates
- Handles user interactions
- Main application controller

### Data Flow

```
Serial Port → SerialReader → BatteryParser → App → UI + ChartManager
```

## Data Format

The application expects data in this format:

```
--- LEITURA ATUAL ---
BATERIA TOTAL (2S): 7.95V

--- Tensões Individuais ---
  Cel 1: 3.96V
  Cel 2: 3.99V

--- Debug (RAW e Tensões Totais por Pino) ---
Módulo 1 (0x48):
  A0 (1S): RAW=22645  Tensão=3.963V
  A1 (2S): RAW=22723  Tensão=7.953V
  A2 (3S): RAW=-1  Tensão=-0.001V
  A3 (4S): RAW=-1  Tensão=-0.001V

Módulo 2 (0x49):
  A0 (5S): RAW=-3  Tensão=-0.003V
  A1 (6S): RAW=-3  Tensão=-0.003V
==========================================================
```

**Important**:
- The parser uses the "Tensões Individuais" section for accurate individual cell voltages
- Cells with negative or very low voltages (≤ 0.1V) are automatically filtered out from display
- Only connected and valid cells will appear in the interface

## Customization

### Battery Chemistry
Adjust voltage thresholds in `battery-parser.js:111`:
```javascript
getCellStatus(voltage) {
    // Modify these values for your battery type
    if (absVoltage >= 3.0 && absVoltage <= 4.3) {
        return 'good';
    }
    // ...
}
```

### Chart Settings
Modify chart options in `chart-manager.js:103`:
```javascript
this.maxDataPoints = 50; // Number of data points to display
```

### Serial Port Settings
Change baud rate in `serial-reader.js:54`:
```javascript
await this.port.open({
    baudRate: 115200, // Change this value
    // ...
});
```

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome  | ✅ Yes  |
| Edge    | ✅ Yes  |
| Firefox | ❌ No   |
| Safari  | ❌ No   |

*Web Serial API is only available in Chromium-based browsers*

## Troubleshooting

### "Web Serial API not supported"
- Use Chrome or Edge browser
- Ensure you're on HTTPS or localhost

### "Failed to open serial port" error
This usually happens when the port is already locked. The application now includes robust cleanup:

1. **First, try disconnecting properly** - Click the Disconnect button and wait for confirmation
2. **If that fails, refresh the page** - The browser will release the port
3. **Check other applications** - Ensure no other software (Arduino IDE, PuTTY, etc.) is using the port
4. **Reconnect the device** - Physically unplug and replug the USB cable

The new implementation includes:
- Automatic cleanup before reconnecting
- Safe operation handling with proper error recovery
- Port release verification with delay
- Prevention of multiple simultaneous connection attempts

### Connection fails
- Check if another application is using the port
- Verify correct baud rate (default: 115200)
- Try disconnecting and reconnecting the device
- Wait a few seconds between disconnect and reconnect

### No data appearing
- Check browser console for errors
- Verify data format matches expected format
- Ensure serial device is sending data
- Check if connection status shows "Connected" (green indicator)

### Chart not showing
- Check if Chart.js CDN is accessible
- Verify data contains valid voltage values
- Check browser console for errors

## Security

This application runs entirely in the browser. No data is sent to external servers. The Web Serial API requires explicit user permission to access serial ports.

## License

MIT

## Credits

- Built with [Chart.js](https://www.chartjs.org/)
- Design inspired by [GitHub Primer](https://primer.style/)
- Uses [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
