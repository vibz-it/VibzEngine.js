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
    OBJECT_ID_GPS_MAP_V0: 0x0200,

    // Time/GPS Sets
    ABS_TIME_SET: 0xFF00,
    REL_TIME_SET: 0xFF01,
    ABS_GPS_SET: 0xFF02,

    // Verification Code
    VERIF_CODE: 55 // 0x37
};

export const Styles = {
    On: 0,
    Off: 1,
    Strobe: 2,
    Wave: 3,
    PW: 4, // Pulse Width ?
    Heartbeat: 5,
    Sparkle: 6,
    Pulse: 7,
    Random: 8,
    ACC_ON: 9,
    ACC_ON_XYZ: 10,
    ACC_CLAP: 11,
    NOT_USE: 12,
    ACC_FLASH: 13,
    Clear: 14,
    ACC_HOLO: 15,
    Boom: 16,
    // ... Accelerometer styles ...
    Blind: 35,
    Wave_Rnd: 36
};

export const BlendingModes = {
    Normal: 0,
    Add: 1,
    And: 2,
    Subtract: 3,
    Multiply: 4,
    Divide: 5
};

export const GoboTypes = {
    None: 0,
    Point: 1,
    Line: 2,
    Polygon: 3
};
