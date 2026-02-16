/**
 * vibz_config.js
 * Central configuration file for the VibzEngine library.
 */

export const Config = {
    // Protocol settings
    BAUD_RATE: 500000,

    // Timing intervals (in milliseconds)
    // How often to send absolute/relative time updates to devices
    TIME_SYNC_INTERVAL: 1500,

    // Base refresh interval for events
    EVENT_REFRESH_INTERVAL: 250,

    // Faster refresh interval for events with intensity variations
    EVENT_REFRESH_INTENSITY_INTERVAL: 50,

    // Watchdog duration: events stop if not refreshed within this time
    EVENT_WATCHDOG_DURATION: 2000,

    // Header/Footer bytes
    HEADER_BYTE: 0x24, // $
    HEADER_WB_ONLY: 0x57, // W
    HEADER_SERVER_ONLY: 0x53, // S
    HEADER_WB_AND_SERVER: 0x24, // $

    FOOTER_BYTES: [0xFF, 0xAB, 0xCD, 0xEF, 0x00]
};
