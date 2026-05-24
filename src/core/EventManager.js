/**
 * EventManager.js
 * Manages active events and handles their refresh lifecycle.
 */

import { Config } from '../config/Config.js';
import { Protocol } from '../protocol/Protocol.js';
import { logger } from '../utils/Logger.js';

function formatHex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) {
        if (i > 0) s += ' ';
        s += bytes[i].toString(16).padStart(2, '0').toUpperCase();
    }
    return s;
}

export class EventManager {
    constructor(transport, timeManager) {
        this.transport = transport; // SerialTransport instance
        this.timeManager = timeManager; // TimeManager instance (for reference time)

        // Map of active events
        // Key: unique ID (or generated string)
        // Value: { eventObject, lastRefreshTime, isActive }
        this.activeEvents = new Map();

        this.refreshLoopId = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.scheduleNextLoop();
        logger.info('Event Manager started.');
    }

    stop() {
        this.isRunning = false;
        if (this.refreshLoopId) {
            clearTimeout(this.refreshLoopId);
            this.refreshLoopId = null;
        }
        this.activeEvents.clear();
        logger.info('Event Manager stopped.');
    }

    /**
     * Adds or updates an event.
     * Triggers an immediate send.
     * @param {string} id - Unique identifier for the event
     * @param {Event} event - The Event object (from BinaryTypes.js)
     */
    addEvent(id, event) {
        // Clone event or store reference? Store reference for now but assume caller prepares it.
        // We need to set start time relative to Reference Time.
        // Wait, the caller might provide `startTime` in absolute terms or relative to video?
        // Let's assume the Event object passed here is ALREADY configured with the correct relative StartTime.
        // OR we should calculate it here.

        // Simplification: We assume the Event object has `startTime` and `stopTime` set as Relative_time_ms
        // which means (EventAbsoluteTime - ReferenceTime).

        this.activeEvents.set(id, {
            event: event,
            lastRefreshTime: 0, // Force immediate refresh
            isActive: true
        });

        // Trigger immediate loop iteration?
        // Or just let the loop handle it. 
        // User requested "immediate update".
        // We can call processLoop immediately if not already running a critical section.
        // But loop runs every 50ms-250ms.
        // Let's force a process call.
        if (this.isRunning) {
            this.processLoop(); // This might cause double send if loop is about to fire, but better responsiveness.
        }
    }

    removeEvent(id) {
        if (this.activeEvents.has(id)) {
            this.activeEvents.delete(id);
            logger.info(`Event ${id} removed.`);
        }
    }

    scheduleNextLoop() {
        if (!this.isRunning) return;

        // Determine next interval based on whether an intense event is active
        // But for simplicity, we can run at 50ms and only send if needed.
        const interval = Config.EVENT_REFRESH_INTENSITY_INTERVAL; // 50ms default for checking

        this.refreshLoopId = setTimeout(() => {
            this.processLoop();
            this.scheduleNextLoop();
        }, interval);
    }

    async processLoop() {
        if (!this.transport.isConnected) return;

        const now = Date.now();
        const refTime = this.timeManager.referenceTime;

        for (const [id, eventData] of this.activeEvents) {
            const event = eventData.event;

            // Check if we need to refresh
            // Logic: Is it time? Or is it an "Intense" event?
            // User requirement: "intensity variation" -> 50ms, else 250ms.
            // How do we know if it has intensity variation? 
            // In the reference app, it checks `choreographyManager.hasIntensityVariation(event)`.
            // Here we don't have that info easily on binary object.
            // Let's assume 250ms default, unless user flagged it?
            // For now, let's use 250ms refresh for everything to be safe, or 100ms.

            const refreshInterval = Config.EVENT_REFRESH_INTERVAL; // 250ms

            if (now - eventData.lastRefreshTime >= refreshInterval) {
                // Refresh needed!

                // Watchdog Logic:
                // Stop Time = Now + Watchdog Duration (relative to reference)
                // We keep the original Start Time (relative to reference) to maintain synchronization.
                // We update Stop Time to keep it "alive" for the next N seconds.

                const relativeNow = now - refTime;

                // Keep-alive watchdog: extend the stop time so the device keeps
                // playing between refreshes. Skipped for events that schedule
                // their own precise stop (autoExtend === false, e.g. the
                // choreography engine sends min(eventStop, now+watchdog) itself)
                // — that way the device honours the real end and self-stops even
                // if the explicit stop frame is dropped on the link.
                if (event.autoExtend !== false) {
                    event.stopTime = relativeNow + Config.EVENT_WATCHDOG_DURATION;
                }

                // IMPORTANT: StartTime usually stays constant for a running event to keep phase alignment (e.g. for Wave effect)
                // However, if we paused and resumed, reference time might have changed?
                // TimeManager handles `referenceTime`. If `referenceTime` changes (e.g. on pause/resume of the app logic), 
                // the `relativeNow` changes.

                // Encode and Send
                const payload = event.encode();
                const frame = Protocol.frameMessage(payload);

                await this.transport.write(frame);

                eventData.lastRefreshTime = now;
                logger.debug(
                    `Event ${id} → ${frame.length}B  payload=[${formatHex(payload)}]  frame=[${formatHex(frame)}]`
                );
            }
        }
    }
}
