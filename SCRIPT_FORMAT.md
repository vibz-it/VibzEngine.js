# Vibz light-script format (v2)

A choreography is a JSON document describing timed light events played on the
bracelets, locked to a media element's playhead by
[`useVibzChoreography`](src/react/useVibzChoreography.ts).

The parser ([`normalizeScript`](src/react/choreography.ts)) accepts **two
formats** and normalises both to the v2 model below:

- **v2** — current, recommended (this document).
- **legacy** — the vibz.it timeline-editor export. Auto-detected by the absence
  of a `version` field; existing scripts keep working with no conversion.

## Top level

| Field      | Type      | Notes |
|------------|-----------|-------|
| `version`  | `2`       | Marks the v2 format. |
| `name`     | string    | Optional, for tooling/debug. |
| `duration` | number    | Optional, indicative media length in seconds. Playback follows the bound media, not this. |
| `loop`     | boolean   | Optional. Informational — looping is driven by the media element itself. |
| `events`   | array     | Required. The light events. |

```json
{
  "version": 2,
  "name": "Magician",
  "duration": 32.001,
  "loop": true,
  "events": [ /* … */ ]
}
```

## Event

| Field      | Type   | Notes |
|------------|--------|-------|
| `id`       | string | Stable, unique. Used as the controller event key. Auto-filled (`evt-N`) if omitted — but **set it explicitly** so two events sharing a `start` on different layers don't collide. |
| `start`    | number | Seconds on the media timeline. |
| `duration` | number | Seconds. The event is live while `start ≤ playhead ≤ start + duration`. |
| `mask`     | number | Optional routing mask (0–255). Default `0`. |
| `layer`    | object | See below. |
| `effect`   | object | See below. |

### `layer`

| Field          | Type             | Default | Notes |
|----------------|------------------|---------|-------|
| `nbr`          | number           | `0`     | Layer index. |
| `opacity`      | number           | `255`   | 0–255. |
| `blendingMode` | string \| number | `Add`   | Enum name (`Normal`, `Add`, `And`, `Subtract`, `Multiply`, `Divide`) or its number. |

### `effect`

| Field       | Type                 | Default | Notes |
|-------------|----------------------|---------|-------|
| `style`     | string \| number     | `On`    | Style **name** (`Wave`, `Sparkle`, `Boom`, `Pulse`, `Heartbeat`, `Strobe`…) or its protocol number. Unknown names are rejected — use the number for styles not in the enum (e.g. accelerometer styles `17`, `22`, `25`). |
| `frequency` | number               | `0`     | 0–255, style-dependent. |
| `duration`  | number               | `100`   | Effect-duration byte (0–255), style-dependent. |
| `color`     | `[r,g,b,w,vib]`      | zeros   | Each 0–255. Trailing channels optional: `[255,0,0]` ≡ `[255,0,0,0,0]`. |
| `intensity` | number \| keyframes  | `255`   | Constant level, or an envelope (below). |

## Intensity envelope (keyframes)

`intensity` is either a scalar `0–255`, or an array of keyframes — strictly
more expressive than the legacy 2-point `intensityStart/End` +
`envelopePoint1X/2X`:

```json
"intensity": [
  { "at": 0.0, "value": 0 },
  { "at": 0.3, "value": 255, "easing": "hold" },
  { "at": 1.0, "value": 60 }
]
```

- `at` — position within the event, `0` (start) … `1` (end).
- `value` — `0–255`.
- `easing` — `"linear"` (default) or `"hold"` (step: keep `value` until the
  next keyframe). Keyframes are sorted by `at`; before the first / after the
  last keyframe the level is clamped to that keyframe's value.

The host samples the envelope each refresh and re-sends the event, so
varying-intensity events refresh ~5× faster than constant ones. An envelope
whose keyframes all share one value collapses to a constant automatically.

## Synchronisation model

`useVibzChoreography` follows `media.currentTime`. Each active event's device
start time is computed once and held **stable** across refreshes (so
phase-based styles like `Wave` stay aligned), and only re-anchored when a
pause/seek is detected (>50 ms drift). A watchdog stop time keeps the device
from latching if refreshes stop. Loop wrap / seek-back is detected and re-arms
events cleanly.

## Legacy → v2 mapping

| Legacy                                              | v2 |
|-----------------------------------------------------|----|
| `startTime`                                         | `start` |
| flat `style` / `frequency` / `intensity`            | nested under `effect` |
| `effectDuration`                                    | `effect.duration` |
| `colors`                                            | `effect.color` |
| `layer.blending_mode`                               | `layer.blendingMode` |
| `intensityStart/End` + `envelopePoint1X/2X`         | `effect.intensity` keyframes |
| `videoId` / `videoDuration`                         | dropped / `duration` (scripts are media-agnostic) |
