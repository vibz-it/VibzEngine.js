export const Identifiers: {
  readonly HELLO_MSG_ID: number;
  readonly COMM_TEST_30B_MSG_ID: number;
  readonly COMM_TEST_95B_MSG_ID: number;
  readonly COMMAND_MSG_ID: number;
  readonly COMMAND_SHORT_MSG_ID: number;
  readonly COMMAND_LONG_MSG_ID: number;
  readonly SYS_CFG_MSG_ID: number;
  readonly OBJECT_ID_EVENT_V0: number;
  readonly OBJECT_ID_EVENT_V0_A: number;
  readonly OBJECT_ID_EVENT_V0_B: number;
  readonly OBJECT_ID_EVENT_GPS_PHASER_V0: number;
  readonly OBJECT_ID_GPS_MAP_V0: number;
  readonly ABS_TIME_SET: number;
  readonly REL_TIME_SET: number;
  readonly ABS_GPS_SET: number;
  readonly VERIF_CODE: number;
};

export const Styles: {
  readonly On: 0;
  readonly Off: 1;
  readonly Strobe: 2;
  readonly Wave: 3;
  readonly PW: 4;
  readonly Heartbeat: 5;
  readonly Sparkle: 6;
  readonly Pulse: 7;
  readonly Random: 8;
  readonly ACC_ON: 9;
  readonly ACC_ON_XYZ: 10;
  readonly ACC_CLAP: 11;
  readonly NOT_USE: 12;
  readonly ACC_FLASH: 13;
  readonly Clear: 14;
  readonly ACC_HOLO: 15;
  readonly Boom: 16;
  readonly Blind: 35;
  readonly Wave_Rnd: 36;
};

export const BlendingModes: {
  readonly Normal: 0;
  readonly Add: 1;
  readonly And: 2;
  readonly Subtract: 3;
  readonly Multiply: 4;
  readonly Divide: 5;
};

export const GoboTypes: {
  readonly None: 0;
  readonly Point: 1;
  readonly Line: 2;
  readonly Polygon: 3;
};
