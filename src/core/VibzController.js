import { Config } from '../config/Config.js';
import { Protocol } from '../protocol/Protocol.js';
import { SerialTransport } from '../transport/SerialTransport.js';
import { TimeManager } from './TimeManager.js';
import { EventManager } from './EventManager.js';
import { logger } from '../utils/Logger.js';

export class VibzController {
    constructor() {
        this.transport = new SerialTransport();
        this.timeManager = new TimeManager(this.transport);
        this.eventManager = new EventManager(this.transport, this.timeManager);
    }

    /**
     * Connect to a device.
     */
    async connect() {
        const success = await this.transport.connect();
        if (success) {
            this.timeManager.start();
            this.eventManager.start();
        }
        return success;
    }

    /**
     * Disconnect from the device.
     */
    async disconnect() {
        this.timeManager.stop();
        this.eventManager.stop();
        await this.transport.disconnect();
    }

    /**
     * Set a callback to be called when the device disconnects unexpectedly.
     * @param {function} callback 
     */
    setOnDisconnect(callback) {
        this.transport.onDisconnect = () => {
            this.timeManager.stop();
            this.eventManager.stop();
            if (callback) callback();
        };
    }

    /**
     * Device reference time (ms, Unix epoch). Relative event times are
     * `Date.now() - referenceTime`. Stable for the life of a connection;
     * used to phase-align scheduled events to an external timeline.
     * @returns {number}
     */
    get referenceTime() {
        return this.timeManager.referenceTime;
    }

    /**
     * Start playing an effect (creates an event).
     * @param {string} id - Unique ID
     * @param {Event} eventObject - The Event object
     */
    playEvent(id, eventObject) {
        // Calculate relative start time based on NOW if not set?
        // Usually, for immediate playback:
        // StartTime = Now - ReferenceTime
        // But the user might want it to start "at 0" of a timeline.
        // If `startTime` is 0, it means it starts at ReferenceTime.

        // If the user passes an event with `startTime` set, we respect it.
        // If `startTime` is 0, we can assume they mean "start now".
        if (eventObject.startTime === 0 && eventObject.stopTime === 0) {
            const now = Date.now();
            const relativeNow = now - this.timeManager.referenceTime;
            eventObject.startTime = relativeNow;
            eventObject.stopTime = relativeNow + Config.EVENT_WATCHDOG_DURATION;
        }

        this.eventManager.addEvent(id, eventObject);
    }

    /**
     * Stop an effect immediately.
     * @param {string} id 
     */
    async stopEvent(id) {
        if (this.eventManager.activeEvents.has(id)) {
            const eventData = this.eventManager.activeEvents.get(id);
            const event = eventData.event;

            // Set stop time to NOW to kill it immediately
            const now = Date.now();
            const relativeNow = now - this.timeManager.referenceTime;
            event.stopTime = relativeNow;

            // Send immediate update
            try {
                const payload = event.encode();
                const frame = Protocol.frameMessage(payload);
                await this.transport.write(frame);
                let hex = '';
                for (let i = 0; i < frame.length; i++) {
                    if (i > 0) hex += ' ';
                    hex += frame[i].toString(16).padStart(2, '0').toUpperCase();
                }
                logger.debug(`Event ${id} STOP → ${frame.length}B  frame=[${hex}]`);
            } catch (e) {
                logger.error(`Failed to send stop signal for event ${id}`, e);
            }

            // Remove from manager so it stops refreshing
            this.eventManager.removeEvent(id);
        }
    }

    /**
     * Configures logging.
     */
    setLogLevel(level) {
        logger.setLevel(level);
    }
}
