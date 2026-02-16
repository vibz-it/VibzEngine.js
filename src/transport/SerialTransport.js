/**
 * SerialTransport.js
 * Wraps the Web Serial API for communication with the wristbands.
 */

import { Config } from '../config/Config.js';
import { logger } from '../utils/Logger.js';

export class SerialTransport {
    constructor() {
        this.port = null;
        this.writer = null;
        this.isConnected = false;
        this.onDisconnect = null; // Callback
    }

    /**
     * Request the user to select a port and connect.
     * @returns {Promise<boolean>} True if connected successfully.
     */
    async connect() {
        if (!navigator.serial) {
            logger.error('Web Serial API not supported in this browser.');
            return false;
        }

        try {
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: Config.BAUD_RATE });

            this.writer = this.port.writable.getWriter();
            this.isConnected = true;

            logger.info(`Connected to serial port at ${Config.BAUD_RATE} baud.`);

            // Monitor disconnection
            this.port.addEventListener('disconnect', () => {
                this.handleDisconnect();
            });

            return true;
        } catch (error) {
            logger.error('Failed to connect:', error);
            this.disconnect(); // Cleanup
            return false;
        }
    }

    /**
     * Disconnects the serial port.
     */
    async disconnect() {
        if (this.writer) {
            try {
                await this.writer.releaseLock();
            } catch (e) {
                console.error(e);
            }
            this.writer = null;
        }

        if (this.port) {
            try {
                await this.port.close();
            } catch (e) {
                console.error(e);
            }
            this.port = null;
        }

        this.isConnected = false;
        logger.info('Disconnected from serial port.');

        if (this.onDisconnect) {
            this.onDisconnect();
        }
    }

    handleDisconnect() {
        logger.warn('Serial port disconnected unexpectedly.');
        this.disconnect();
    }

    /**
     * Writes data to the serial port.
     * @param {Uint8Array} data 
     */
    async write(data) {
        if (!this.isConnected || !this.writer) {
            // logger.warn('Cannot write: Port not connected.');
            return;
        }

        try {
            await this.writer.write(data);
        } catch (error) {
            logger.error('Write error:', error);
            this.handleDisconnect(); // Assume connection lost on write error
        }
    }
}
