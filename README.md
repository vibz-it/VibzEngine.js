# VibzEngine JS Library

A JavaScript library to control Vibz light-up wristbands via Web Serial API.

## Features
- **Web Serial Connectivity**: Direct connection to USB devices from Chrome/Edge.
- **Time Synchronization**: Automatically maintains absolute and relative time sync with devices.
- **Event Management**: Handles event keep-alive (watchdog) and refreshing logic.
- **Low Latency**: Optimized for high-performance timing (up to 500k baud).

## Directory Structure
```
/src
  /config       # Configuration (timeouts, baud rate)
  /core         # Main logic (TimeManager, EventManager, VibzController)
  /protocol     # Binary protocol definitions and encoding
  /transport    # Serial port communication
  /utils        # Logging
/examples       # Test pages
index.js        # Main entry point
```

## Quick Start

### 1. Installation
Simply include the files in your project. This library is designed as ES Modules.

### 2. Basic Usage

```javascript
import { VibzController, Event, Styles } from './path/to/VibzEngine/index.js';

// 1. Initialize
const controller = new VibzController();

// 2. Connect (must be triggered by user gesture)
document.getElementById('connectBtn').addEventListener('click', async () => {
    await controller.connect();
});

// 3. Create and Send Event
function sendLight() {
    const evt = new Event();
    evt.effect.style = Styles.Pulse;
    evt.effect.color = [255, 0, 0, 0, 0]; // Red
    evt.effect.intensity = 255;
    
    // Send event with ID "my_event"
    controller.playEvent("my_event", evt);
}

// 4. Stop Event
function stopLight() {
    controller.stopEvent("my_event");
}
```

## Integration Guide

### Integration in HTML/Static Sites
See `examples/simple_html/index.html` for a complete example.
Ensure your server serves the files with correct MIME types for `.js` modules.

### Integration in Framer / React
1. Copy the `src` folder and `index.js` into your project (e.g., `src/vibz-engine`).
2. Import `VibzController` in your React component.
3. Use `useEffect` to handle cleanup on unmount:
   ```javascript
   useEffect(() => {
       return () => {
           controller.disconnect();
       };
   }, []);
   ```

## Configuration
You can adjust timeouts and intervals in `src/config/Config.js`.
- `TIME_SYNC_INTERVAL`: Default 1500ms
- `EVENT_REFRESH_INTERVAL`: Default 250ms
- `EVENT_WATCHDOG_DURATION`: Default 2000ms

## Troubleshooting
- **Browser Support**: Only Chrome, Edge, and Opera support Web Serial API. Firefox and Safari are NOT supported.
- **Permissions**: The user MUST grant permission via the browser prompt.
- **Logs**: Enable debug logging: `logger.setLevel(0);`
