/**
 * TimeManager.js
 * Handles periodic time synchronization with the devices.
 */

import { Config } from '../config/Config.js';
import { AbsoluteTime, RelativeTimeReference } from '../protocol/BinaryTypes.js';
import { Protocol } from '../protocol/Protocol.js';
import { logger } from '../utils/Logger.js';

export class TimeManager {
    constructor(transport) {
        this.transport = transport;
        this.intervalId = null;
        this.referenceTime = Date.now(); // Local reference time
    }

    /**
     * Starts the periodic time synchronization.
     */
    start() {
        if (this.intervalId) return;

        // Reset reference time on start
        this.referenceTime = Date.now();

        // Send immediately
        this.sendSync();

        // Schedule periodic sync
        this.intervalId = setInterval(() => {
            this.sendSync();
        }, Config.TIME_SYNC_INTERVAL);

        logger.info('Time synchronization started.');
    }

    /**
     * Stops the synchronization.
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        logger.info('Time synchronization stopped.');
    }

    /**
     * Sends the current absolute and relative time to the device.
     */
    async sendSync() {
        if (!this.transport.isConnected) return;

        const now = Date.now();
        const nowMicroseconds = BigInt(now) * 1000n;
        const refMicroseconds = BigInt(this.referenceTime) * 1000n;

        // 1. Absolute Time (Unix Epoch)
        const absTime = new AbsoluteTime(nowMicroseconds);
        const absPayload = absTime.encode();
        const absFrame = Protocol.frameMessage(absPayload); // WB_AND_SERVER by default

        await this.transport.write(absFrame);

        // 2. Relative Time Reference (Session Start Time)
        // This sets the base time for Relative_time_ms events
        const relTimeRef = new RelativeTimeReference(refMicroseconds);
        const relPayload = relTimeRef.encode();
        const relFrame = Protocol.frameMessage(relPayload);

        await this.transport.write(relFrame);

        logger.debug(`Time Sync Sent: Abs=${now}, Ref=${this.referenceTime}`);
    }

    /**
     * updates the reference time.
     * Useful if the session restarts or reconnects.
     */
    resetReferenceTime() {
        this.referenceTime = Date.now();
    }
}
