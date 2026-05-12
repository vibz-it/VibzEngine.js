import * as React from "react"
import { Event } from "https://react.vibz-it.com/index.js"

/**
 * @framerIntrinsicWidth 200
 * @framerIntrinsicHeight 80
 */
export function VibzScrollEffect(props) {
    const [isConnected, setIsConnected] = React.useState(false)
    const [intensity, setIntensity] = React.useState(0)
    const lastUpdateRef = React.useRef(0)

    React.useEffect(() => {
        // Function to check connection status from global object
        const checkConnection = () => {
            if (window.vibzController &&
                window.vibzController.transport &&
                window.vibzController.transport.isConnected) {
                setIsConnected(true);
            } else {
                setIsConnected(false);
            }
        };

        // Listen for the custom event dispatched by VibzConnection
        window.addEventListener("vibz-connection-change", checkConnection);

        // Check immediately in case it's already connected
        checkConnection();

        return () => {
            window.removeEventListener("vibz-connection-change", checkConnection);
        };
    }, []);

    React.useEffect(() => {
        if (!isConnected) return;

        const handleScroll = () => {
            // Access global controller
            const controller = window.vibzController;
            if (!controller) return;

            const scrollTop = window.scrollY;
            const docHeight = document.body.scrollHeight - window.innerHeight;
            const scrollPercent = Math.min(Math.max(scrollTop / docHeight, 0), 1);
            const newIntensity = Math.floor(scrollPercent * 255);

            setIntensity(Math.round(scrollPercent * 100));

            const now = Date.now();
            if (now - lastUpdateRef.current > 50) {
                sendEvent(controller, newIntensity);
                lastUpdateRef.current = now;
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [isConnected]);

    const sendEvent = (controller, val) => {
        const evt = new Event();
        evt.id = 1;
        evt.effect.style = 0; // On
        evt.effect.color = [0, 0, 255, 0, 0]; // Blue
        evt.effect.intensity = val;
        evt.layer.opacity = 255;

        try {
            controller.playEvent("scroll_effect", evt);
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <div style={containerStyle}>
            <div style={{ opacity: isConnected ? 1 : 0.5 }}>
                {isConnected ? "Active" : "Waiting for Connection..."}
            </div>
            <div style={{ fontWeight: "bold", color: "#2196F3" }}>
                Intensity: {intensity}%
            </div>
        </div>
    )
}

const containerStyle = {
    padding: 15,
    background: "#222",
    color: "#fff",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, sans-serif",
    fontSize: 12
}
