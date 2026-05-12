import * as React from "react"

/**
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 200
 */
export function VibzLogConsole(props) {
    const [logs, setLogs] = React.useState([])
    const containerRef = React.useRef(null)

    React.useEffect(() => {
        // Function to add log to state
        const addLog = (msg, type = "info") => {
            const time = new Date().toISOString().split('T')[1].slice(0, -1);
            setLogs(prev => [...prev.slice(-49), { time, msg, type }]); // Keep 50 logs
        };

        // 1. Intercept Console Logs (Optional, can be invasive)
        // Or better: Listen to a custom event that our other components dispatch?
        // Let's do a Custom Event listener "vibz-log"
        const handleCustomLog = (e) => {
            if (e.detail) {
                addLog(e.detail.message, e.detail.type);
            }
        };

        window.addEventListener("vibz-log", handleCustomLog);

        // Also listen for connection changes to log them automatically
        const handleConnectionChange = () => {
            const isConnected = window.vibzController?.transport?.isConnected;
            addLog(isConnected ? "Device Connected" : "Device Disconnected", isConnected ? "success" : "warn");
        }
        window.addEventListener("vibz-connection-change", handleConnectionChange);

        // Initial welcome
        addLog("Log Console Ready", "info");

        return () => {
            window.removeEventListener("vibz-log", handleCustomLog);
            window.removeEventListener("vibz-connection-change", handleConnectionChange);
        };
    }, []);

    // Auto-scroll
    React.useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div style={containerStyle} ref={containerRef}>
            {logs.length === 0 && <div style={{ opacity: 0.5 }}>- Waiting for logs -</div>}
            {logs.map((log, i) => (
                <div key={i} style={{ ...rowStyle, color: getColor(log.type) }}>
                    <span style={{ opacity: 0.5, marginRight: 8 }}>[{log.time}]</span>
                    <span>{log.msg}</span>
                </div>
            ))}
        </div>
    )
}

function getColor(type) {
    switch (type) {
        case "error": return "#ff5555";
        case "warn": return "#ffb86c";
        case "success": return "#50fa7b";
        default: return "#f8f8f2";
    }
}

const containerStyle = {
    width: "100%",
    height: "100%",
    background: "#282a36",
    color: "#f8f8f2",
    fontFamily: "Menlo, Monaco, Consolas, monospace",
    fontSize: 11,
    padding: 10,
    overflowY: "auto",
    borderRadius: 8,
    border: "1px solid #44475a",
    display: "flex",
    flexDirection: "column",
    gap: 4
}

const rowStyle = {
    lineHeight: "1.4em",
    wordBreak: "break-all"
}
