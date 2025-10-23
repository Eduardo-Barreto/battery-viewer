/**
 * BatteryParser - Module for parsing battery reading data
 * Parses the text format from the battery reader into structured data
 */

export class BatteryParser {
    constructor() {
        // Regex patterns for parsing
        this.patterns = {
            totalVoltage: /BATERIA TOTAL \((\d+)S\):\s+([-\d.]+)V/,
            individualCell: /Cel\s+(\d+):\s+([-\d.]+)V/,
            moduleHeader: /Módulo\s+(\d+)\s+\(0x([0-9A-Fa-f]+)\):/,
            pinData: /A(\d+)\s+\((\d+)S\):\s+RAW=([-\d]+)\s+Tensão=([-\d.]+)V/
        };
    }

    /**
     * Parse complete reading text
     * @param {string} text - Raw reading text
     * @returns {Object} Parsed data structure
     */
    parse(text) {
        const data = {
            timestamp: new Date(),
            totalVoltage: 0,
            cellCount: 0,
            cells: [],
            individualCells: [],
            modules: []
        };

        // Split into lines
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);

        // Parse total voltage
        const totalMatch = text.match(this.patterns.totalVoltage);
        if (totalMatch) {
            data.cellCount = parseInt(totalMatch[1]);
            data.totalVoltage = parseFloat(totalMatch[2]);
        }

        // Parse individual cell voltages (from "Tensões Individuais" section)
        for (const line of lines) {
            const cellMatch = line.match(this.patterns.individualCell);
            if (cellMatch) {
                const cellNumber = parseInt(cellMatch[1]);
                const voltage = parseFloat(cellMatch[2]);

                data.individualCells.push({
                    name: `${cellNumber}S`,
                    number: cellNumber,
                    individualVoltage: voltage,
                    status: this.getCellStatus(voltage)
                });
            }
        }

        // Parse modules and pin data
        let currentModule = null;

        for (const line of lines) {
            // Check for module header
            const moduleMatch = line.match(this.patterns.moduleHeader);
            if (moduleMatch) {
                if (currentModule) {
                    data.modules.push(currentModule);
                }
                currentModule = {
                    id: parseInt(moduleMatch[1]),
                    address: moduleMatch[2],
                    pins: []
                };
                continue;
            }

            // Check for pin data
            const pinMatch = line.match(this.patterns.pinData);
            if (pinMatch && currentModule) {
                const pin = {
                    pin: `A${pinMatch[1]}`,
                    cell: `${pinMatch[2]}S`,
                    cellNumber: parseInt(pinMatch[2]),
                    raw: parseInt(pinMatch[3]),
                    voltage: parseFloat(pinMatch[4])
                };

                currentModule.pins.push(pin);

                // Add to cells array with cumulative voltage
                data.cells.push({
                    name: pin.cell,
                    number: pin.cellNumber,
                    voltage: pin.voltage,
                    raw: pin.raw,
                    module: currentModule.id,
                    pin: pin.pin
                });
            }
        }

        // Add last module
        if (currentModule) {
            data.modules.push(currentModule);
        }

        // Sort cells by cell number
        data.cells.sort((a, b) => a.number - b.number);

        // Merge individual voltages into cells array
        // Use the parsed individual voltages if available, otherwise calculate
        if (data.individualCells.length > 0) {
            for (const cell of data.cells) {
                const individualCell = data.individualCells.find(ic => ic.number === cell.number);
                if (individualCell) {
                    cell.individualVoltage = individualCell.individualVoltage;
                    cell.status = individualCell.status;
                } else {
                    cell.individualVoltage = 0;
                    cell.status = 'danger';
                }
            }
        } else {
            // Fallback: calculate differential if individual cells section is missing
            this.calculateIndividualVoltages(data.cells);
        }

        return data;
    }

    /**
     * Calculate individual cell voltages from cumulative readings
     * Each reading shows cumulative voltage, we need individual cell voltage
     * @param {Array} cells - Array of cell objects
     */
    calculateIndividualVoltages(cells) {
        for (let i = 0; i < cells.length; i++) {
            if (i === 0) {
                // First cell voltage is the same as reading
                cells[i].individualVoltage = cells[i].voltage;
            } else {
                // Subsequent cells are differential
                cells[i].individualVoltage = cells[i].voltage - cells[i - 1].voltage;
            }

            // Determine cell health status
            cells[i].status = this.getCellStatus(cells[i].individualVoltage);
        }
    }

    /**
     * Determine cell health status based on voltage
     * @param {number} voltage - Cell voltage
     * @returns {string} Status: 'good', 'warning', 'danger'
     */
    getCellStatus(voltage) {
        const absVoltage = Math.abs(voltage);

        // Typical Li-ion cell voltage ranges: 3.0V - 4.2V
        // Adjust thresholds based on your battery chemistry
        if (absVoltage < 0.1) {
            return 'danger'; // Very low or no voltage
        } else if (absVoltage >= 3.0 && absVoltage <= 4.3) {
            return 'good'; // Normal range
        } else if (absVoltage > 4.3 || (absVoltage > 0.1 && absVoltage < 2.5)) {
            return 'warning'; // Out of normal range
        }

        return 'good';
    }

    /**
     * Validate parsed data
     * @param {Object} data - Parsed data object
     * @returns {boolean} True if data is valid
     */
    validate(data) {
        if (!data) return false;
        if (typeof data.totalVoltage !== 'number') return false;
        if (!Array.isArray(data.cells)) return false;
        if (!Array.isArray(data.modules)) return false;

        return true;
    }

    /**
     * Get summary statistics from parsed data
     * @param {Object} data - Parsed data object
     * @returns {Object} Summary statistics
     */
    getSummary(data) {
        if (!data.cells || data.cells.length === 0) {
            return {
                count: 0,
                avgVoltage: 0,
                minVoltage: 0,
                maxVoltage: 0,
                voltageSpread: 0
            };
        }

        const voltages = data.cells.map(c => c.individualVoltage).filter(v => v > 0);

        if (voltages.length === 0) {
            return {
                count: 0,
                avgVoltage: 0,
                minVoltage: 0,
                maxVoltage: 0,
                voltageSpread: 0
            };
        }

        const minVoltage = Math.min(...voltages);
        const maxVoltage = Math.max(...voltages);
        const avgVoltage = voltages.reduce((a, b) => a + b, 0) / voltages.length;

        return {
            count: voltages.length,
            avgVoltage: avgVoltage,
            minVoltage: minVoltage,
            maxVoltage: maxVoltage,
            voltageSpread: maxVoltage - minVoltage
        };
    }

    /**
     * Format voltage for display
     * @param {number} voltage - Voltage value
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted voltage string
     */
    formatVoltage(voltage, decimals = 3) {
        return voltage.toFixed(decimals);
    }

    /**
     * Format timestamp for display
     * @param {Date} date - Date object
     * @returns {string} Formatted time string
     */
    formatTimestamp(date) {
        return date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Export data as JSON
     * @param {Object} data - Parsed data object
     * @returns {string} JSON string
     */
    exportJSON(data) {
        return JSON.stringify(data, null, 2);
    }

    /**
     * Export data as CSV
     * @param {Object} data - Parsed data object
     * @returns {string} CSV string
     */
    exportCSV(data) {
        const headers = ['Timestamp', 'Cell', 'Cumulative Voltage (V)', 'Individual Voltage (V)', 'RAW', 'Module', 'Pin', 'Status'];
        const rows = [headers];

        const timestamp = this.formatTimestamp(data.timestamp);

        for (const cell of data.cells) {
            rows.push([
                timestamp,
                cell.name,
                cell.voltage.toFixed(3),
                cell.individualVoltage.toFixed(3),
                cell.raw,
                cell.module,
                cell.pin,
                cell.status
            ]);
        }

        return rows.map(row => row.join(',')).join('\n');
    }
}
