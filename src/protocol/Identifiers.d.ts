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
  readonly OBJECT_ID_EVENT_STRIP_V0: number;
  readonly OBJECT_ID_GPS_MAP_V0: number;
  readonly ABS_TIME_SET: number;
  readonly REL_TIME_SET: number;
  readonly ABS_GPS_SET: number;
  readonly VERIF_CODE: number;
};

export const Styles: {
  readonly On: 0;
  readonly Strobe: 2;
  readonly Wave: 3;
  readonly Heartbeat: 5;
  readonly Sparkle: 6;
  readonly Random: 8;
  readonly ACC_ON_XYZ: 10;
  readonly ACC_CLAP: 11;
  readonly ACC_HOLO: 15;
  readonly Boom: 16;
  readonly ACC_POSITION_X_PN: 17;
  readonly ACC_POSITION_Y_PN: 18;
  readonly ACC_POSITION_Z_PN: 19;
  readonly ACC_POSITION_X_P: 20;
  readonly ACC_POSITION_Y_P: 21;
  readonly ACC_POSITION_Z_P: 22;
  readonly ACC_POSITION_X_N: 23;
  readonly ACC_POSITION_Y_N: 24;
  readonly ACC_POSITION_Z_N: 25;
  readonly ACC_MVNT_X_PN: 26;
  readonly ACC_MVNT_Y_PN: 27;
  readonly ACC_MVNT_Z_PN: 28;
  readonly ACC_MVNT_X_P: 29;
  readonly ACC_MVNT_Y_P: 30;
  readonly ACC_MVNT_Z_P: 31;
  readonly ACC_MVNT_X_N: 32;
  readonly ACC_MVNT_Y_N: 33;
  readonly ACC_MVNT_Z_N: 34;
  readonly Blind: 35;
  readonly Wave_Rnd: 36;
  readonly Torque_Shake: 37;
};

export const BlendingModes: {
  readonly Normal: 0;
  readonly Add: 1;
  readonly And: 2;
  readonly Subtract: 3;
  readonly Multiply: 4;
  readonly Divide: 5;
};

export const StripStyles: {
  readonly Off: 0;
  readonly ColorSweep: 1;
  readonly Comet: 2;
  readonly DoubleSpin: 3;
  readonly ImpactWave: 4;
  readonly KittWide: 5;
  readonly PulseBeat: 6;
  readonly RainbowComet: 7;
  readonly Shimmer: 8;
  readonly VuMeter: 9;
  readonly VuMeterPeak: 10;
  readonly Direction: 11;
  readonly DirectionDyn: 12;
  readonly Battery: 13;
  readonly Compass: 14;
};

export const STRIP_PARAM_COUNT: number;

export const GoboTypes: {
  readonly None: 0;
  readonly Point: 1;
  readonly Line: 2;
  readonly Polygon: 3;
};
