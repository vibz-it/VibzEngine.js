/**
 * Protocol.js
 * Handles framing (Header, Footer, Parity) for the serial communication.
 */

import { Config } from '../config/Config.js';

export class Protocol {
    /**
     * Calculates XOR parity for the payload
     * @param {Array<number>} bytes - The message bytes INCLUDING header
     * @returns {number} parity byte
     */
    static calculateParity(bytes) {
        let parity = 0;
        // Exclude the first two bytes (Header '$' and Type 'W'/'S') from parity calculation?
        // Checking legacy code: 
        // "Exclure les deux premiers bytes (header) du calcul de parité"
        // for (let i = 2; i < messageArray.length; i++) parity ^= messageArray[i];

        for (let i = 2; i < bytes.length; i++) {
            parity ^= bytes[i];
        }
        return parity;
    }

    /**
     * Wraps a payload in the protocol frame.
     * Format: [$][W/S] [PAYLOAD] [PARITY] [FOOTER] [0x00]
     * @param {Uint8Array} payload 
     * @param {string} mode - 'WB', 'Server', or 'Both' (default)
     * @returns {Uint8Array} Framed message
     */
    static frameMessage(payload, mode = 'Both') {
        const frame = [];

        // 1. Header
        frame.push(Config.HEADER_BYTE); // '$'

        if (mode === 'WB') {
            frame.push(Config.HEADER_WB_ONLY);
        } else if (mode === 'Server') {
            frame.push(Config.HEADER_SERVER_ONLY);
        } else {
            frame.push(Config.HEADER_WB_AND_SERVER); // Default '$' (Wait, is it '$' again?)
            // Legacy code says: result.push(0x24); // '$' pour WBAndServer
        }

        // 2. Payload
        for (let i = 0; i < payload.length; i++) {
            frame.push(payload[i]);
        }

        // 3. Parity
        const parity = Protocol.calculateParity(frame);
        frame.push(parity);

        // 4. Footer
        Config.FOOTER_BYTES.forEach(b => frame.push(b));

        return new Uint8Array(frame);
    }
}
