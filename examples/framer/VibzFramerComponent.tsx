import * as React from "react"
// IMPORTANT: You need to import the built library. 
// If you cannot import local files in Framer, you might need to host the 'VibzEngine' folder 
// on a server (or GitHub Pages) and import from there, e.g.:
// import { VibzController, Event } from "https://your-domain.com/VibzEngine/index.js"
// For this example, we assume it's available or pasted in.

// Use the hosted index.js URL (assuming you uploaded index.js + src folder)
import { VibzController, Event } from "https://react.vibz-it.com/index.js"

/**
 * @framerIntrinsicWidth 200
 * @framerIntrinsicHeight 200
 */
export function VibzTest(props) {
    const [status, setStatus] = React.useState("Disconnected")
    const [isConnected, setIsConnected] = React.useState(false)

    // Use a ref to keep the controller instance alive across re-renders
    const controllerRef = React.useRef(null)

    React.useEffect(() => {
        // Initialize controller once
        controllerRef.current = new VibzController()

        // Handle unexpected disconnections
        controllerRef.current.setOnDisconnect(() => {
            setIsConnected(false)
            setStatus("Disconnected (Lost)")
        })

        return () => {
            // Cleanup on component unmount
            if (controllerRef.current) {
                controllerRef.current.disconnect()
            }
        }
    }, [])

    const handleConnect = async () => {
        if (!controllerRef.current) return

        try {
            const success = await controllerRef.current.connect()
            if (success) {
                setIsConnected(true)
                setStatus("Connected")
            } else {
                setStatus("Failed to Connect")
            }
        } catch (e) {
            setStatus("Error: " + e.message)
        }
    }

    const handleSendEvent = () => {
        if (!controllerRef.current || !isConnected) return

        // Create a simple test event
        const evt = new Event()
        evt.effect.style = 6 // Sparkle
        evt.effect.color = [0, 0, 255, 0, 0] // Blue
        evt.effect.duration = 0 // Infinite
        evt.layer.opacity = 255

        // Send as event_1
        controllerRef.current.playEvent("event_1", evt)
        console.log("Sent Event: Sparkle Blue")
    }

    return (
        <div style={containerStyle}>
            <div style={statusStyle(isConnected)}>
                Status: {status}
            </div>

            <button
                style={buttonStyle}
                onClick={handleConnect}
                disabled={isConnected}
            >
                {isConnected ? "Connected" : "Connect USB"}
            </button>

            <button
                style={{ ...buttonStyle, background: isConnected ? "#2196F3" : "#555" }}
                onClick={handleSendEvent}
                disabled={!isConnected}
            >
                Send Blue Sparkle
            </button>
        </div>
    )
}

// Simple internal styles
const containerStyle = {
    padding: 20,
    background: "#222",
    color: "#fff",
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Inter, sans-serif"
}

const statusStyle = (active) => ({
    fontSize: 12,
    fontWeight: "bold",
    color: active ? "#4CAF50" : "#ff5555",
    marginBottom: 10
})

const buttonStyle = {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: "#444",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    width: "100%"
}
