/**
 * Identifiers.js
 * Protocol constants and object IDs.
 */

export const Identifiers = {
    // Control messages
    HELLO_MSG_ID: 0x1000,
    COMM_TEST_30B_MSG_ID: 0x1010,
    COMM_TEST_95B_MSG_ID: 0x1011,
    COMMAND_MSG_ID: 0x1020,
    COMMAND_SHORT_MSG_ID: 0x1021,
    COMMAND_LONG_MSG_ID: 0x1022,
    SYS_CFG_MSG_ID: 0x1030,

    // Object IDs
    OBJECT_ID_EVENT_V0: 0x0000,
    OBJECT_ID_EVENT_V0_A: 0x0001, // With Target UID
    OBJECT_ID_EVENT_V0_B: 0x0002,
    OBJECT_ID_EVENT_GPS_PHASER_V0: 0x0100,
    OBJECT_ID_EVENT_STRIP_V0: 0x0110, // Addressable LED-strip event (WS2812B)
    OBJECT_ID_GPS_MAP_V0: 0x0200,

    // Time/GPS Sets
    ABS_TIME_SET: 0xFF00,
    REL_TIME_SET: 0xFF01,
    ABS_GPS_SET: 0xFF02,

    // Verification Code
    VERIF_CODE: 55 // 0x37
};

// Effect styles — mirror of the firmware `Style` enum in
// vibz-it/wristband_objects → Event.h. Keep this in sync with that file; it is
// the single source of truth (the editor's effect picker derives from it).
// Slots 1, 4, 7, 9, 12, 13, 14 are RESERVED on the device (formerly Off, PW,
// Pulse, ACC_ON, NOT_USE, ACC_FLASH, Clear) and intentionally omitted.
export const Styles = {
    On: 0,
    Strobe: 2,
    Wave: 3,
    Heartbeat: 5,
    Sparkle: 6,
    Random: 8,
    ACC_ON_XYZ: 10,
    ACC_CLAP: 11,
    ACC_HOLO: 15,
    Boom: 16,
    // Accelerometer — absolute position (PN = both directions, P/N = single)
    ACC_POSITION_X_PN: 17,
    ACC_POSITION_Y_PN: 18,
    ACC_POSITION_Z_PN: 19,
    ACC_POSITION_X_P: 20,
    ACC_POSITION_Y_P: 21,
    ACC_POSITION_Z_P: 22,
    ACC_POSITION_X_N: 23,
    ACC_POSITION_Y_N: 24,
    ACC_POSITION_Z_N: 25,
    // Accelerometer — movement
    ACC_MVNT_X_PN: 26,
    ACC_MVNT_Y_PN: 27,
    ACC_MVNT_Z_PN: 28,
    ACC_MVNT_X_P: 29,
    ACC_MVNT_Y_P: 30,
    ACC_MVNT_Z_P: 31,
    ACC_MVNT_X_N: 32,
    ACC_MVNT_Y_N: 33,
    ACC_MVNT_Z_N: 34,
    Blind: 35,
    Wave_Rnd: 36,
    // Motor "tork shake": rapid direction reversal (color[4] = amplitude);
    // lights follow normally.
    Torque_Shake: 37
};

export const BlendingModes = {
    Normal: 0,
    Add: 1,
    And: 2,
    Subtract: 3,
    Multiply: 4,
    Divide: 5
};

// Effect styles for the addressable LED strip (WS2812B) — mirror of the
// firmware `Style_strip` enum (Event.h). Names drop the `Strip_` prefix (the
// object is already namespaced). Used by `EventStrip` (object 0x0110).
export const StripStyles = {
    Off: 0,
    ColorSweep: 1,
    Comet: 2,
    DoubleSpin: 3,
    ImpactWave: 4,
    KittWide: 5,
    PulseBeat: 6,
    RainbowComet: 7,
    Shimmer: 8,
    VuMeter: 9,
    VuMeterPeak: 10,
    Direction: 11,
    DirectionDyn: 12,
    Battery: 13,
    Compass: 14
};

/** Number of generic uint8 params carried by an `EffectStrip` (style-dependent). */
export const STRIP_PARAM_COUNT = 8;

export const GoboTypes = {
    None: 0,
    Point: 1,
    Line: 2,
    Polygon: 3
};
