/**
 * Logger.js
 * Simple logging utility for the VibzEngine library.
 */

export class Logger {
    static LEVEL = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        NONE: 4
    };

    constructor() {
        this.level = Logger.LEVEL.INFO;
        this.customOutput = null; // Optional callback for UI logging
    }

    /**
     * Set the logging level
     * @param {number} level - One of Logger.LEVEL values
     */
    setLevel(level) {
        this.level = level;
    }

    /**
     * Set a custom output function (e.g., to log to a DOM element)
     * @param {function} callback - Function(message, level)
     */
    setCustomOutput(callback) {
        this.customOutput = callback;
    }

    debug(message, ...args) {
        if (this.level <= Logger.LEVEL.DEBUG) {
            console.debug(`[Vibz][DEBUG] ${message}`, ...args);
            this._logToCustom(message, 'DEBUG');
        }
    }

    info(message, ...args) {
        if (this.level <= Logger.LEVEL.INFO) {
            console.log(`[Vibz][INFO] ${message}`, ...args);
            this._logToCustom(message, 'INFO');
        }
    }

    warn(message, ...args) {
        if (this.level <= Logger.LEVEL.WARN) {
            console.warn(`[Vibz][WARN] ${message}`, ...args);
            this._logToCustom(message, 'WARN');
        }
    }

    error(message, ...args) {
        if (this.level <= Logger.LEVEL.ERROR) {
            console.error(`[Vibz][ERROR] ${message}`, ...args);
            this._logToCustom(message, 'ERROR');
        }
    }

    _logToCustom(message, level) {
        if (this.customOutput) {
            this.customOutput(`[${level}] ${message}`, level);
        }
    }
}

// Singleton instance
export const logger = new Logger();
