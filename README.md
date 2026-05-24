# VibzEngine JS Library

A JavaScript library to control Vibz light-up wristbands via Web Serial API.

## Features
- **Web Serial Connectivity**: Direct connection to USB devices from Chrome/Edge.
- **Time Synchronization**: Automatically maintains absolute and relative time sync with devices.
- **Event Management**: Handles event keep-alive (watchdog) and refreshing logic.
- **Low Latency**: Optimized for high-performance timing (up to 500k baud).

## Deployment & CORS (Framer Integration)

To use this library in Framer (or any other external web app), your server must allow Cross-Origin Resource Sharing (CORS). This means adding the `Access-Control-Allow-Origin: *` header to your server's response for `.js` files.

### 1. Apache (.htaccess) - Standard for OVH Shared Hosting
Create or edit the `.htaccess` file in your root or library folder:
```apache
<IfModule mod_headers.c>
    <FilesMatch "\.(js|mjs)$">
        Header set Access-Control-Allow-Origin "*"
    </FilesMatch>
</IfModule>
```

### 2. Nginx (nginx.conf)
Add this to your server block or location block:
```nginx
location ~* \.(js|mjs)$ {
    add_header Access-Control-Allow-Origin *;
}
```

### 3. Vercel (vercel.json)
Create a `vercel.json` file:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]
    }
  ]
}
```

### 4. Netlify (_headers)
Create a `_headers` file in your publish directory:
```
/*
  Access-Control-Allow-Origin: *
```

### 5. PHP (If serving via PHP)
Add this at the very top of your PHP file serving the content:
```php
<?php
header("Access-Control-Allow-Origin: *");
// ... rest of your code
?>
```

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
    evt.effect.style = Styles.Heartbeat;
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

### React bindings (`vibz-engine/react`)

The package ships a headless React layer. The library owns *behavior*
(connection, frame send/stop, pointer + keyboard handling); your app owns
*rendering* (JSX, CSS, classNames). Three primitives:

- `VibzProvider` — owns a single `VibzController` and exposes it via context.
- `useVibz()` — returns `{ status, error, connect, disconnect, controller }`.
- `useVibzButton()` / `<VibzButton>` — press-to-light behavior with multi-input
  tracking. Returns `ref`, `handlers`, `state` (pressed, hovering, focused,
  connected, disabled). Multi-source aware: holding mouse AND space won't
  double-stop on release of either alone.

```tsx
import {
  VibzProvider, useVibz, VibzButton, Styles,
} from 'vibz-engine/react';

function App() {
  return (
    <VibzProvider>
      <ConnectButton />
      <PulseButton />
    </VibzProvider>
  );
}

function ConnectButton() {
  const { status, connect, disconnect } = useVibz();
  return (
    <button onClick={status === 'connected' ? disconnect : connect}>
      {status === 'connected' ? 'Disconnect' : 'Connect Vibz'}
    </button>
  );
}

function PulseButton() {
  return (
    <VibzButton event={{
      effect: { style: Styles.Heartbeat, color: [255, 49, 75], frequency: 2 },
    }}>
      {({ ref, handlers, state }) => (
        <button
          ref={ref}
          {...handlers}
          disabled={!state.connected}
          className={state.pressed ? 'glow' : ''}
        >
          {state.connected ? 'Hold to pulse' : 'Connect first'}
        </button>
      )}
    </VibzButton>
  );
}
```

Status values: `'unsupported' | 'idle' | 'connecting' | 'connected' |
'disconnecting' | 'error'`.

#### Vanilla import (no React)

```javascript
import { VibzController, Event, Styles } from 'vibz-engine';
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
