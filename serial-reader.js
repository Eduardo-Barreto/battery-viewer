/**
 * SerialReader - Module for managing Web Serial API connection
 * Handles connection, disconnection, and reading data from serial port
 */

export class SerialReader {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.onDataCallback = null;
        this.onStatusChangeCallback = null;
        this.readableStreamClosed = null;
        this.writableStreamClosed = null;
        this.buffer = '';
        this.keepReading = false;
        this.isDisconnecting = false;
    }

    /**
     * Register callback for received data
     * @param {Function} callback - Function to call with parsed data
     */
    onData(callback) {
        this.onDataCallback = callback;
    }

    /**
     * Register callback for connection status changes
     * @param {Function} callback - Function to call with status updates
     */
    onStatusChange(callback) {
        this.onStatusChangeCallback = callback;
    }

    /**
     * Update connection status and notify listeners
     * @param {string} status - Status: 'connected', 'disconnected', 'error'
     * @param {string} message - Optional message
     */
    updateStatus(status, message = '') {
        this.isConnected = status === 'connected';
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback(status, message);
        }
    }

    /**
     * Check if Web Serial API is supported
     * @returns {boolean}
     */
    isSupported() {
        return 'serial' in navigator;
    }

    /**
     * Connect to serial port
     * Opens port picker dialog and establishes connection
     */
    async connect(baudRate = 115200) {
        if (!this.isSupported()) {
            this.updateStatus('error', 'Web Serial API not supported. Use Chrome/Edge browser.');
            throw new Error('Web Serial API not supported');
        }

        // Check if already connecting
        if (this.isDisconnecting) {
            console.log('Still disconnecting, please wait...');
            return;
        }

        // If port exists but not connected, clean up first
        if (this.port && !this.isConnected) {
            console.log('Cleaning up previous connection...');
            await this._cleanupConnection();
        }

        // Double check if already connected
        if (this.port && this.isConnected) {
            console.log('Already connected.');
            return;
        }

        try {
            this.updateStatus('connecting', 'Connecting...');

            // Request port from user
            this.port = await navigator.serial.requestPort();

            // Open port with common baud rates for Arduino/ESP
            await this.port.open({
                baudRate: baudRate,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none'
            });

            // Setup text decoder stream
            const textDecoder = new TextDecoderStream();
            this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
            this.reader = textDecoder.readable.getReader();

            // Setup writer
            this.writer = this.port.writable.getWriter();

            this.keepReading = true;
            this.isDisconnecting = false;
            this.updateStatus('connected', 'Connected to serial port');
            console.log('Serial port connected successfully');

            // Start reading in background
            this.readLoop().catch(error => {
                if (!this.isDisconnecting && error.name !== 'NetworkError' && error.name !== 'AbortError') {
                    console.error('Error in read loop:', error);
                    this.updateStatus('error', `Read error: ${error.message}`);
                }
            });

        } catch (error) {
            console.error('Connection error:', error);
            // Clean up on connection failure
            await this._cleanupConnection();
            this.updateStatus('error', error.message);
            throw error;
        }
    }

    /**
     * Main read loop - continuously reads data from serial port
     */
    async readLoop() {
        try {
            while (this.port && this.keepReading && !this.isDisconnecting) {
                const { value, done } = await this.reader.read();

                if (done) {
                    console.log('Stream closed by device');
                    break;
                }

                if (value) {
                    this.processData(value);
                }
            }
        } catch (error) {
            // Only treat as error if not expected disconnection
            if (error.name === 'NetworkError' || error.name === 'AbortError' || this.isDisconnecting) {
                console.log('Serial connection closed');
            } else {
                throw error; // Re-throw unexpected errors
            }
        }
    }

    /**
     * Process incoming data and extract complete readings
     * @param {string} chunk - Data chunk from serial port
     */
    processData(chunk) {
        // Add chunk to buffer
        this.buffer += chunk;

        // Split by separator line
        const separator = '==========================================================';
        const parts = this.buffer.split(separator);

        // Process all complete readings (all parts except the last)
        for (let i = 0; i < parts.length - 1; i++) {
            const reading = parts[i].trim();
            if (reading && this.onDataCallback) {
                this.onDataCallback(reading);
            }
        }

        // Keep the last incomplete part in buffer
        this.buffer = parts[parts.length - 1];

        // Prevent buffer overflow
        if (this.buffer.length > 10000) {
            console.warn('Buffer overflow, clearing');
            this.buffer = '';
        }
    }

    /**
     * Disconnect from serial port
     */
    async disconnect() {
        if (this.isDisconnecting) {
            console.log('Already disconnecting...');
            return;
        }

        if (!this.port) {
            console.log('Not connected');
            this.updateStatus('disconnected', 'Disconnected from serial port');
            return;
        }

        console.log('Starting disconnection...');
        this.isDisconnecting = true;
        this.keepReading = false;

        try {
            await this._cleanupConnection();
        } catch (error) {
            console.warn('Error during cleanup:', error);
            // Force cleanup even if it fails
            this.port = null;
            this.reader = null;
            this.writer = null;
            this.readableStreamClosed = null;
            this.writableStreamClosed = null;
            this.isDisconnecting = false;
        }

        // Always update status to disconnected
        this.updateStatus('disconnected', 'Disconnected from serial port');
        console.log('Disconnected - port should be released');
    }

    /**
     * Clean up connection resources
     * @private
     */
    async _cleanupConnection() {
        console.log('Starting connection cleanup...');

        // Step 1: Stop reading
        this.keepReading = false;

        // Step 2: Cancel reader (automatically releases lock)
        if (this.reader) {
            await this._safeOperation(async () => {
                await this.reader.cancel();
            }, 'cancel reader');
        }

        // Step 3: Close writer (automatically releases lock)
        if (this.writer) {
            await this._safeOperation(async () => {
                await this.writer.close();
            }, 'close writer');
        }

        // Step 4: Wait for readable pipe to finish
        if (this.readableStreamClosed) {
            await this._safeOperation(async () => {
                await this.readableStreamClosed;
            }, 'wait for readable pipe to close');
        }

        // Step 5: Wait for writable pipe to finish
        if (this.writableStreamClosed) {
            await this._safeOperation(async () => {
                await this.writableStreamClosed;
            }, 'wait for writable pipe to close');
        }

        // Step 6: Close port (this releases browser indicator)
        if (this.port) {
            await this._safeOperation(async () => {
                await this.port.close();
                // Small delay to ensure browser processes the port release
                await new Promise(resolve => setTimeout(resolve, 100));
            }, 'close port');
        }

        // Step 7: Clear all references
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.readableStreamClosed = null;
        this.writableStreamClosed = null;
        this.isDisconnecting = false;
        this.buffer = '';

        console.log('Cleanup completed - port released');
    }

    /**
     * Safely execute an operation, catching and logging errors
     * @private
     * @param {Function} operation - Async operation to execute
     * @param {string} operationName - Name for logging
     */
    async _safeOperation(operation, operationName) {
        try {
            await operation();
        } catch (error) {
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            console.warn(`⚠ ${operationName} - failed: ${errorMsg}`);
        }
    }

    /**
     * Write data to serial port
     * @param {string} data - Data to write
     */
    async write(data) {
        if (!this.writer || this.isDisconnecting) {
            throw new Error('Cannot write. Port is not connected.');
        }

        console.log('Sending:', data);

        try {
            const encodedData = new TextEncoder().encode(data + '\r\n');
            await this.writer.write(encodedData);
        } catch (error) {
            if (!this.isDisconnecting) {
                console.error('Write error:', error);
                throw error;
            }
        }
    }

    /**
     * Get connection status
     * @returns {boolean}
     */
    getConnectionStatus() {
        return this.isConnected;
    }
}
