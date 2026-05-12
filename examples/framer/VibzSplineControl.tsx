import * as React from "react"
import { Event } from "https://react.vibz-it.com/index.js"
// Use esm.sh which is often more stable for Framer than Skypack
import Spline from "https://esm.sh/@splinetool/react-spline";

/**
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 400
 * @framerDisableUnlink true
 */
export function VibzSplineControl(props) {
    const [isConnected, setIsConnected] = React.useState(false)
    const [objInfo, setObjInfo] = React.useState({ x: 0, y: 0 })
    const lastUpdateRef = React.useRef(0)
    const splineAppRef = React.useRef(null)
    const frameRef = React.useRef(null)

    // Spline Scene URL
    const sceneUrl = "https://prod.spline.design/NKJWJ7JyY1KOfxKH/scene.splinecode";

    React.useEffect(() => {
        const checkConnection = () => {
            const active = window.vibzController && window.vibzController.transport && window.vibzController.transport.isConnected;
            setIsConnected(!!active);
        }

        window.addEventListener("vibz-connection-change", checkConnection);
        checkConnection();

        return () => window.removeEventListener("vibz-connection-change", checkConnection);
    }, []);

    const onLoad = (splineApp) => {
        splineAppRef.current = splineApp;
        // Start Loop
        startLoop();
    }

    const startLoop = () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);

        const loop = () => {
            frameRef.current = requestAnimationFrame(loop);

            if (!splineAppRef.current) return;

            // CHANGE THIS to your object name if different
            const objName = "Cube";
            const obj = splineAppRef.current.findObjectByName(objName);

            if (obj) {
                const x = obj.position.x;
                const y = obj.position.y;

                // Map Spline Coordinates (-X to +X) to Color (0-255)
                // Adjust divisor based on scene scale
                const r = Math.min(Math.max((x + 200) / 400 * 255, 0), 255);
                const b = Math.min(Math.max((y + 200) / 400 * 255, 0), 255);

                setObjInfo({ x: Math.round(x), y: Math.round(y) });

                if (isConnected) {
                    const now = Date.now();
                    if (now - lastUpdateRef.current > 50) {
                        sendColor(Math.round(r), 0, Math.round(b));
                        lastUpdateRef.current = now;
                    }
                }
            }
        };

        loop();
    }

    const sendColor = (r, g, b) => {
        const controller = window.vibzController;
        if (!controller) return;

        const evt = new Event();
        evt.id = 3;
        evt.effect.style = 0;
        evt.effect.color = [r, g, b, 0, 0];
        evt.effect.intensity = 255;
        evt.layer.opacity = 255;

        try {
            controller.playEvent("spline_3d", evt);
        } catch (e) { }
    }

    return (
        <div style={containerStyle}>
            <div style={overlayStyle}>
                Position: X {objInfo.x} Y {objInfo.y} <br />
                {!isConnected && <span style={{ color: "orange" }}>Connecting...</span>}
            </div>

            <Spline
                scene={props.scene || sceneUrl}
                onLoad={onLoad}
            />
        </div>
    )
}

const containerStyle = {
    width: "100%",
    height: "100%",
    position: "relative",
    background: "#000",
    overflow: "hidden"
}

const overlayStyle = {
    position: "absolute",
    top: 10,
    left: 10,
    color: "#fff",
    fontFamily: "Inter, sans-serif",
    fontSize: 12,
    background: "rgba(0,0,0,0.5)",
    padding: 8,
    borderRadius: 4,
    pointerEvents: "none",
    zIndex: 10
}
