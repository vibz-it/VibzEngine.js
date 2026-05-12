import * as React from "react"
import { VibzController } from "https://react.vibz-it.com/index.js"

/**
 * @framerIntrinsicWidth 150
 * @framerIntrinsicHeight 50
 */
export function VibzConnection(props) {
    const [status, setStatus] = React.useState("Disconnected")
    const [isConnected, setIsConnected] = React.useState(false)

    React.useEffect(() => {
        // Setup Global Controller if not exists
        if (!window.vibzController) {
            window.vibzController = new VibzController();
        }

        // Listen for internal disconnects to update UI
        window.vibzController.setOnDisconnect(() => {
            setIsConnected(false);
            setStatus("Disconnected (Lost)");
            // Dispatch event for other components
            window.dispatchEvent(new Event("vibz-connection-change"));
        });

        // Initial check
        if (window.vibzController.transport && window.vibzController.transport.isConnected) {
            setIsConnected(true);
            setStatus("Connected");
        }
    }, [])

    const handleConnect = async () => {
        if (!window.vibzController) return;

        try {
            const success = await window.vibzController.connect();
            if (success) {
                setIsConnected(true);
                setStatus("Connected");
                // IMPORTANT: Notify other components
                window.dispatchEvent(new Event("vibz-connection-change"));
            } else {
                setStatus("Failed");
            }
        } catch (e) {
            setStatus("Error: " + e.message);
        }
    }

    return (
        <button
            style={{
                ...buttonStyle,
                background: isConnected ? "#4CAF50" : "#2196F3"
            }}
            onClick={isConnected ? null : handleConnect}
        >
            {isConnected ? "Connected" : "Connect USB"}
        </button>
    )
}

const buttonStyle = {
    padding: "10px 15px",
    borderRadius: 8,
    border: "none",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    width: "100%",
    height: "100%",
    fontSize: 14
}
