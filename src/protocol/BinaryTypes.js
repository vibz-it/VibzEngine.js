/**
 * BinaryTypes.js
 * Definitions of binary structures used in the protocol.
 */

import { Identifiers } from './Identifiers.js';

/**
 * Utility to build binary buffers (Little Endian)
 */
export class BufferBuilder {
    constructor() {
        this.buffer = [];
    }

    appendUint8(value) {
        this.buffer.push(value & 0xFF);
    }

    appendInt8(value) {
        this.buffer.push(value & 0xFF); // Same as Uint8 for array push
    }

    appendUint16(value) {
        this.buffer.push(value & 0xFF);
        this.buffer.push((value >> 8) & 0xFF);
    }

    appendInt16(value) {
        this.appendUint16(value); // Two's complement handling is automatic when casting to bytes
    }

    appendUint32(value) {
        this.buffer.push(value & 0xFF);
        this.buffer.push((value >> 8) & 0xFF);
        this.buffer.push((value >> 16) & 0xFF);
        this.buffer.push((value >> 24) & 0xFF);
    }

    appendInt32(value) {
        this.appendUint32(value);
    }

    appendUint64(value) {
        const bigVal = BigInt(value);
        for (let i = 0; i < 8; i++) {
            this.buffer.push(Number((bigVal >> BigInt(8 * i)) & 0xFFn));
        }
    }

    appendArray(array) {
        for (let val of array) {
            this.buffer.push(val);
        }
    }

    getBuffer() {
        return new Uint8Array(this.buffer);
    }
}

/**
 * Layer Structure
 */
export class Layer {
    constructor(nbr = 0, opacity = 255, blendingMode = 0) {
        this.nbr = nbr;
        this.opacity = opacity;
        this.blendingMode = blendingMode;
    }
}

/**
 * Effect Structure
 */
export class Effect {
    constructor() {
        this.style = 0; // Off
        this.frequency = 0;
        this.duration = 0;
        this.intensity = 0;
        this.color = [0, 0, 0, 0, 0]; // R, G, B, W, Vib
    }
}

/**
 * Localization Structure
 */
export class Localization {
    constructor() {
        this.zoom = 0;
        this.focus = 0;
        this.goboType = 0; // None
        this.mapId = 0xFF; // No map
        this.lat = 0; // 10cm units
        this.lon = 0; // 10cm units
    }
}

/**
 * Event Structure
 */
export class Event {
    constructor() {
        this.id = 0;
        this.mask = 0;
        this.targetUid = 0n; // BigInt
        this.startTime = 0; // Relative time ms (int32)
        this.stopTime = 0; // Relative time ms (int32)

        this.layer = new Layer();
        this.effect = new Effect();
        this.localization = new Localization();
    }

    encode() {
        const builder = new BufferBuilder();

        // Identifier
        const hasUid = (this.targetUid !== 0n);
        const identifier = hasUid ? Identifiers.OBJECT_ID_EVENT_V0_A : Identifiers.OBJECT_ID_EVENT_V0;

        builder.appendUint16(identifier);
        builder.appendUint8(this.mask);

        if (hasUid) {
            builder.appendUint64(this.targetUid);
        }

        builder.appendInt32(this.startTime);
        builder.appendInt32(this.stopTime);

        // Layer
        builder.appendUint8(this.layer.blendingMode);
        builder.appendUint8(this.layer.nbr);
        builder.appendUint8(this.layer.opacity);

        // Effect
        builder.appendUint8(this.effect.duration);
        builder.appendUint8(this.effect.intensity);
        builder.appendUint8(this.effect.frequency);
        builder.appendUint8(this.effect.style);
        builder.appendArray(this.effect.color.slice(0, 5)); // Ensure 5 bytes

        // Localization
        builder.appendUint8(this.localization.zoom);
        builder.appendUint8(this.localization.focus);
        builder.appendUint8(this.localization.goboType);
        builder.appendUint8(this.localization.mapId);

        builder.appendUint16(this.localization.lat);
        builder.appendUint16(this.localization.lon);

        // Verification Code
        builder.appendUint8(Identifiers.VERIF_CODE);

        return builder.getBuffer();
    }
}

/**
 * Absolute Time Structure (for Sync)
 */
export class AbsoluteTime {
    constructor(microseconds = 0n) {
        this.timeUs = BigInt(microseconds);
    }

    encode() {
        const builder = new BufferBuilder();
        builder.appendUint16(Identifiers.ABS_TIME_SET);
        builder.appendUint64(this.timeUs);
        return builder.getBuffer();
    }
}

/**
 * Relative Reference Time Structure (for Sync)
 */
export class RelativeTimeReference {
    constructor(microseconds = 0n) {
        this.timeUs = BigInt(microseconds);
    }

    encode() {
        const builder = new BufferBuilder();
        builder.appendUint16(Identifiers.REL_TIME_SET);
        builder.appendUint64(this.timeUs);
        return builder.getBuffer();
    }
}
