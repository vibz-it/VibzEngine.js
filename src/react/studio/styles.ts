import { useEffect } from 'react';

/** Scoped, dependency-free stylesheet for the studio overlay. */
export const STUDIO_CSS = `
.vz-studio{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;
  background:#0c0d10;color:#e9eaee;font:14px/1.45 'Inter',system-ui,sans-serif;}
.vz-studio *{box-sizing:border-box;}
.vz-studio button{font:inherit;cursor:pointer;border:1px solid #2c2f37;background:#1a1c22;
  color:#e9eaee;padding:7px 12px;border-radius:7px;transition:background .12s,border-color .12s;}
.vz-studio button:hover:not(:disabled){background:#23262e;border-color:#3a3e48;}
.vz-studio button:disabled{opacity:.4;cursor:not-allowed;}
.vz-studio button.primary{background:#ff314b;border-color:#ff314b;color:#fff;}
.vz-studio button.primary:hover:not(:disabled){background:#e62942;}
.vz-studio button.danger{border-color:#5a2630;color:#ff6b81;}
.vz-studio input,.vz-studio select{font:inherit;background:#15171c;color:#e9eaee;
  border:1px solid #2c2f37;border-radius:6px;padding:6px 8px;width:100%;}
.vz-studio input[type=color]{padding:2px;height:32px;}
.vz-studio input[type=range]{padding:0;}
.vz-bar{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #1f2127;
  background:#101218;flex:0 0 auto;}
.vz-bar .grow{flex:1;}
.vz-bar h2{margin:0;font-size:14px;font-weight:700;letter-spacing:.02em;}
.vz-pill{font-size:12px;padding:3px 9px;border-radius:999px;border:1px solid #2c2f37;color:#aab;}
.vz-pill.on{color:#27d07f;border-color:#1f5a3f;background:#10231a;}
.vz-pill.off{color:#ff6b81;border-color:#5a2630;background:#23121620;}
.vz-body{flex:1;display:flex;min-height:0;}
.vz-left{flex:1;display:flex;flex-direction:column;min-width:0;border-right:1px solid #1f2127;}
.vz-video-wrap{flex:0 0 auto;padding:16px;display:flex;flex-direction:column;gap:10px;align-items:center;}
.vz-video-wrap video{max-height:42vh;width:auto;max-width:100%;background:#000;border-radius:8px;}
.vz-drop{border:2px dashed #2c2f37;border-radius:12px;padding:48px 24px;text-align:center;
  color:#9aa;width:100%;transition:border-color .12s,background .12s;}
.vz-drop.drag{border-color:#ff314b;background:#1a1216;}
.vz-vidctl{display:flex;gap:10px;align-items:center;font-size:12px;color:#aab;flex-wrap:wrap;justify-content:center;}
.vz-timeline-tools{display:flex;gap:8px;padding:10px 16px;border-top:1px solid #1f2127;
  border-bottom:1px solid #1f2127;align-items:center;flex-wrap:wrap;}
.vz-timeline-tools .grow{flex:1;}
.vz-tl-scroll{flex:1;overflow:auto;min-height:0;padding:0 0 16px;}
.vz-ruler{position:relative;height:24px;border-bottom:1px solid #23262e;
  background:#101218;font-size:10px;color:#778;min-width:100%;}
.vz-ruler .t{position:absolute;top:0;height:100%;border-left:1px solid #23262e;padding-left:4px;}
.vz-lane{position:relative;border-bottom:1px solid #16181d;}
.vz-lane-label{position:sticky;left:0;z-index:2;display:inline-block;font-size:10px;
  color:#889;background:#101218cc;padding:2px 8px;border-bottom-right-radius:6px;}
.vz-ev{position:absolute;top:22px;height:38px;border-radius:6px;overflow:hidden;
  border:1px solid rgba(255,255,255,.18);cursor:grab;user-select:none;color:#0a0a0a;
  font-size:11px;font-weight:600;padding:4px 8px;white-space:nowrap;}
.vz-ev.sel{outline:2px solid #fff;outline-offset:1px;}
.vz-ev .env{position:absolute;inset:0;pointer-events:none;}
.vz-ev .grip{position:absolute;top:0;bottom:0;width:7px;cursor:ew-resize;}
.vz-ev .grip.l{left:0;}.vz-ev .grip.r{right:0;}
.vz-playhead{position:absolute;top:0;bottom:0;width:2px;background:#ff314b;
  pointer-events:none;z-index:3;box-shadow:0 0 6px #ff314b;}
.vz-right{flex:0 0 340px;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:14px;}
.vz-right.empty{align-items:center;justify-content:center;color:#667;text-align:center;}
.vz-field{display:flex;flex-direction:column;gap:4px;}
.vz-field label{font-size:11px;color:#9aa;text-transform:uppercase;letter-spacing:.04em;}
.vz-row{display:flex;gap:10px;}.vz-row>*{flex:1;}
.vz-sec{border:1px solid #1f2127;border-radius:9px;padding:12px;display:flex;flex-direction:column;gap:10px;}
.vz-sec h4{margin:0;font-size:12px;color:#cdd;}
.vz-swatch{width:100%;height:26px;border-radius:6px;border:1px solid #2c2f37;}
.vz-hint{font-size:11px;color:#778;}
.vz-toast{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);
  background:#1a1c22;border:1px solid #3a3e48;padding:8px 16px;border-radius:8px;font-size:12px;}
.vz-ev .env{display:block;overflow:visible;z-index:1;}
.vz-envpt{position:absolute;width:11px;height:11px;border-radius:50%;
  background:#fff;border:2px solid #0a0a0a;transform:translate(-50%,-50%);
  pointer-events:auto;touch-action:none;z-index:2;}
/* Tight 5-column color editor: labelled, centred, no spinner buttons. */
.vz-color-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
.vz-color-grid > div{display:flex;flex-direction:column;align-items:stretch;gap:2px;min-width:0;}
.vz-color-grid > div > label{font-size:10px;color:#aab;text-transform:none;letter-spacing:0;text-align:center;}
.vz-color-grid > div > input{padding:5px 4px;text-align:center;font-variant-numeric:tabular-nums;font-size:12px;}
.vz-studio input[type=number]{-moz-appearance:textfield;}
.vz-studio input[type=number]::-webkit-outer-spin-button,
.vz-studio input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.vz-envpt:hover{background:#ffd23f;}
.vz-menu{position:fixed;z-index:2147483600;min-width:170px;background:#1a1c22;
  border:1px solid #3a3e48;border-radius:8px;padding:5px;box-shadow:0 10px 30px #000a;}
.vz-menu div{padding:7px 12px;border-radius:5px;font-size:13px;}
.vz-menu div:hover{background:#2a2d36;}
.vz-menu div.sep{padding:0;margin:4px 0;border-top:1px solid #2c2f37;pointer-events:none;}
.vz-menu div.dim{color:#667;pointer-events:none;}

/* Host sites may hide the native cursor for a custom one (vibz.show does:
   \`html *,body *{cursor:none!important}\`). The studio is a tool UI — force
   the real cursor back, with !important to win against that rule. */
.vz-studio,.vz-studio *{cursor:auto !important;}
.vz-studio button,.vz-studio select,.vz-studio label,
.vz-studio input[type=checkbox],.vz-studio input[type=radio],
.vz-studio input[type=color],.vz-studio input[type=range],
.vz-studio .vz-ruler,.vz-studio .vz-lane{cursor:pointer !important;}
.vz-studio button:disabled{cursor:not-allowed !important;}
.vz-studio .vz-ev{cursor:grab !important;}
.vz-studio .vz-ev .grip{cursor:ew-resize !important;}
`;

let injected = false;
/** Inject the studio stylesheet once per document. */
export function useStudioStyles(): void {
  useEffect(() => {
    if (injected || typeof document === 'undefined') return;
    const el = document.createElement('style');
    el.setAttribute('data-vibz-studio', '');
    el.textContent = STUDIO_CSS;
    document.head.appendChild(el);
    injected = true;
  }, []);
}
