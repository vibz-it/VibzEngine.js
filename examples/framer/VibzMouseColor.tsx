import * as React from "react"
import { Event } from "https://react.vibz-it.com/index.js"

/**
 * @framerIntrinsicWidth 300
 * @framerIntrinsicHeight 300
 */
export function VibzMouseColor(props) {
    const [isConnected, setIsConnected] = React.useState(false)
    const [color, setColor] = React.useState([0, 0, 0]) // RGB for UI display
    const lastUpdateRef = React.useRef(0)

    // Setup global connection listener
    React.useEffect(() => {
        const checkConnection = () => {
            if (window.vibzController &&
                window.vibzController.transport &&
                window.vibzController.transport.isConnected) {
                setIsConnected(true);
            } else {
                setIsConnected(false);
            }
        };

        window.addEventListener("vibz-connection-change", checkConnection);
        checkConnection();
        return () => window.removeEventListener("vibz-connection-change", checkConnection);
    }, []);

    // Mouse Move Handler
    const handleMouseMove = (e) => {
        if (!isConnected) return;

        // Get mouse position relative to the element
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left; // 0 to width
        const y = e.clientY - rect.top;  // 0 to height

        const width = rect.width;
        const height = rect.height;

        // Map X to Hue (0-360), Y to Lightness
        const hue = (x / width); // 0.0 - 1.0
        const sat = 1.0;
        const lig = Math.max(0.1, 1.0 - (y / height)); // Avoid pure black at bottom if we want color

        const rgb = hslToRgb(hue, sat, 0.5);

        setColor(rgb);

        // Send to device (Throttled)
        const now = Date.now();
        if (now - lastUpdateRef.current > 50) {
            sendEvent(window.vibzController, rgb);
            lastUpdateRef.current = now;
        }
    }

    // Mouse Leave Handler - Turns light OFF
    const handleMouseLeave = () => {
        if (!isConnected) return;
        setColor([0, 0, 0]); // Update UI to black

        // Force send "Black" event to turn off light
        sendEvent(window.vibzController, [0, 0, 0]);
    }

    const sendEvent = (controller, rgb) => {
        if (!controller) return;

        const evt = new Event();
        evt.id = 2;
        evt.effect.style = 0; // On
        evt.effect.color = [rgb[0], rgb[1], rgb[2], 0, 0];
        evt.effect.intensity = 255;
        evt.layer.opacity = 255;

        try {
            controller.playEvent("mouse_color", evt);
        } catch (e) { }
    }

    return (
        <div
            style={{ ...containerStyle, background: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <div style={{
                background: "rgba(0,0,0,0.5)",
                padding: "10px",
                borderRadius: "8px",
                textAlign: "center"
            }}>
                <div style={{ fontSize: 12, marginBottom: 5 }}>
                    {isConnected ? "Move Mouse Here" : "Connect USB First"}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 10 }}>
                    R:{color[0]} G:{color[1]} B:{color[2]}
                </div>
            </div>
        </div>
    )
}

// Helpers
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const containerStyle = {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    cursor: "crosshair",
    transition: "background 0.1s ease"
}
