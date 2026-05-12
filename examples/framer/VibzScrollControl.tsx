import * as React from "react"

// Import from your hosted library
import { VibzController, Event } from "https://react.vibz-it.com/index.js"

/**
 * @framerIntrinsicWidth 200
 * @framerIntrinsicHeight 100
 */
export function VibzScrollControl(props) {
    const [status, setStatus] = React.useState("Disconnected")
    const [isConnected, setIsConnected] = React.useState(false)
    const [intensity, setIntensity] = React.useState(0)
    const [logs, setLogs] = React.useState([])

    // Refs
    // Use a ref to store the controller instance so it persists between renders
    const controllerRef = React.useRef(null)
    const lastUpdateRef = React.useRef(0) // For throttling
    const logContainerRef = React.useRef(null)

    // Simple Log function
    const addLog = (msg, level = "INFO") => {
        const time = new Date().toISOString().split('T')[1].slice(0, -1);
        setLogs(prev => [...prev.slice(-19), `[${time}] ${msg}`]) // Keep last 20 logs
    }

    // 1. Initialize Controller (Run ONCE on mount)
    React.useEffect(() => {
        // Create controller instance
        controllerRef.current = new VibzController()

        // Hook into disconnect callback
        controllerRef.current.setOnDisconnect(() => {
            // Check if we are actually still mounted/running
            setIsConnected(false)
            setStatus("Disconnected (Lost)")
            addLog("WARN: Device disconnected unexpectedly")
        })

        // Cleanup on UNMOUNT only
        return () => {
            if (controllerRef.current) {
                controllerRef.current.disconnect()
            }
        }
    }, []) // Empty dependency array = runs only on mount/unmount

    // 2. Setup Scroll Listener (Run when connection state changes)
    React.useEffect(() => {
        if (!isConnected) return

        const handleScroll = () => {
            if (!controllerRef.current) return

            // Calculate Scroll Percentage (0.0 to 1.0)
            const scrollTop = window.scrollY
            const docHeight = document.body.scrollHeight - window.innerHeight
            const scrollPercent = Math.min(Math.max(scrollTop / docHeight, 0), 1)

            // Map to 0-255
            const newIntensity = Math.floor(scrollPercent * 255)

            // Update UI state for debug
            setIntensity(Math.round(scrollPercent * 100))

            // Throttle sending to device (e.g., max once every 50ms)
            const now = Date.now()
            if (now - lastUpdateRef.current > 50) {
                sendIntensityUpdate(newIntensity)
                lastUpdateRef.current = now
            }
        }

        window.addEventListener("scroll", handleScroll)

        // When disconnected or component updates, remove listener
        return () => {
            window.removeEventListener("scroll", handleScroll)
        }
    }, [isConnected])

    // Auto-scroll logs
    React.useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
        }
    }, [logs])

    const sendIntensityUpdate = (val) => {
        if (!controllerRef.current) return

        const evt = new Event()
        evt.id = 1
        evt.effect.style = 0
        evt.effect.color = [0, 0, 255, 0, 0]
        evt.effect.duration = 0
        evt.effect.intensity = val
        evt.layer.opacity = 255
        evt.layer.nbr = 0

        // Send Update
        try {
            controllerRef.current.playEvent("scroll_event", evt)
        } catch (e) {
            addLog(`ERROR Send: ${e.message}`)
        }
    }

    const handleConnect = async () => {
        addLog("Click Connect...")
        if (!controllerRef.current) return
        try {
            const success = await controllerRef.current.connect()
            if (success) {
                setIsConnected(true)
                setStatus("Connected")
                addLog("Connected successfully")
            } else {
                setStatus("Failed")
                addLog("ERROR: Failed to connect (User cancelled?)")
            }
        } catch (e) {
            setStatus("Error")
            addLog(`ERROR Connect: ${e.message}`)
        }
    }

    return (
        <div style={containerStyle}>
            <div style={statusStyle(isConnected)}>
                {status} | Intensity: {intensity}%
            </div>

            {!isConnected && (
                <button
                    style={buttonStyle}
                    onClick={handleConnect}
                >
                    Connect USB
                </button>
            )}

            {isConnected && (
                <div style={{ fontSize: 10, opacity: 0.7 }}>
                    Scroll to control light
                </div>
            )}

            {/* Log Console Area */}
            <div style={logContainerStyle} ref={logContainerRef}>
                {logs.length === 0 && <div style={{ opacity: 0.5 }}>- No logs -</div>}
                {logs.map((log, i) => (
                    <div key={i} style={logEntryStyle}>{log}</div>
                ))}
            </div>
        </div>
    )
}

// -- Styles --

const containerStyle = {
    padding: 15,
    background: "#111",
    color: "#fff",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Inter, sans-serif",
    border: "1px solid #333"
}

const statusStyle = (active) => ({
    fontSize: 12,
    fontWeight: "bold",
    color: active ? "#4CAF50" : "#ff5555",
})

const buttonStyle = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    background: "#2196F3",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 12
}

const logContainerStyle = {
    width: "100%",
    height: "100px",
    background: "#000",
    borderRadius: 4,
    padding: 5,
    overflowY: "auto",
    fontSize: 10,
    fontFamily: "monospace",
    marginTop: 10,
    border: "1px solid #444",
    textAlign: "left"
}

const logEntryStyle = {
    marginBottom: 2,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    borderBottom: "1px solid #222"
}
