/**
 * Battery Monitor - Main Application
 * Orchestrates all modules and manages UI updates
 */

import { SerialReader } from './serial-reader.js';
import { ChartManager } from './chart-manager.js';
import { BatteryParser } from './battery-parser.js';

class BatteryMonitor {
    constructor() {
        // Initialize modules
        this.serialReader = new SerialReader();
        this.parser = new BatteryParser();
        this.chartManager = null;

        // State
        this.readingCount = 0;
        this.lastReading = null;

        // DOM elements
        this.elements = {
            connectBtn: document.getElementById('connectBtn'),
            statusIndicator: document.querySelector('.status-indicator'),
            statusText: document.querySelector('.status-text'),
            totalVoltage: document.getElementById('totalVoltage'),
            cellCount: document.getElementById('cellCount'),
            cellsGrid: document.getElementById('cellsGrid'),
            modulesContainer: document.getElementById('modulesContainer'),
            lastUpdate: document.getElementById('lastUpdate'),
            readingCount: document.getElementById('readingCount'),
            clearChartBtn: document.getElementById('clearChartBtn'),
            voltageChart: document.getElementById('voltageChart'),
            exportBtn: document.getElementById('exportBtn'),
            exportMenu: document.getElementById('exportMenu'),
            exportCurrentJSON: document.getElementById('exportCurrentJSON'),
            exportCurrentCSV: document.getElementById('exportCurrentCSV'),
            exportHistoryJSON: document.getElementById('exportHistoryJSON'),
            exportHistoryCSV: document.getElementById('exportHistoryCSV'),
            exportChartImage: document.getElementById('exportChartImage')
        };

        this.init();
    }

    /**
     * Initialize application
     */
    init() {
        // Check browser support
        if (!this.serialReader.isSupported()) {
            this.showError('Web Serial API not supported. Please use Chrome or Edge browser.');
            this.elements.connectBtn.disabled = true;
            return;
        }

        // Initialize chart
        this.chartManager = new ChartManager(this.elements.voltageChart);

        // Setup event listeners
        this.setupEventListeners();

        // Setup serial reader callbacks
        this.serialReader.onData((data) => this.handleData(data));
        this.serialReader.onStatusChange((status, message) => this.updateConnectionStatus(status, message));

        console.log('Battery Monitor initialized');
    }

    /**
     * Setup UI event listeners
     */
    setupEventListeners() {
        // Connect/disconnect button
        this.elements.connectBtn.addEventListener('click', () => this.toggleConnection());

        // Clear chart button
        this.elements.clearChartBtn.addEventListener('click', () => this.clearChart());

        // Export dropdown toggle
        this.elements.exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExportMenu();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.elements.exportMenu.contains(e.target) && e.target !== this.elements.exportBtn) {
                this.closeExportMenu();
            }
        });

        // Export buttons
        this.elements.exportCurrentJSON.addEventListener('click', () => {
            this.exportJSON();
            this.closeExportMenu();
        });

        this.elements.exportCurrentCSV.addEventListener('click', () => {
            this.exportCSV();
            this.closeExportMenu();
        });

        this.elements.exportHistoryJSON.addEventListener('click', () => {
            this.exportHistoryJSON();
            this.closeExportMenu();
        });

        this.elements.exportHistoryCSV.addEventListener('click', () => {
            this.exportHistoryCSV();
            this.closeExportMenu();
        });

        this.elements.exportChartImage.addEventListener('click', () => {
            this.exportChartImage();
            this.closeExportMenu();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K to connect
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggleConnection();
            }
            // Ctrl/Cmd + L to clear chart
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this.clearChart();
            }
            // Escape to close dropdown
            if (e.key === 'Escape') {
                this.closeExportMenu();
            }
        });
    }

    /**
     * Toggle export menu visibility
     */
    toggleExportMenu() {
        this.elements.exportMenu.classList.toggle('show');
    }

    /**
     * Close export menu
     */
    closeExportMenu() {
        this.elements.exportMenu.classList.remove('show');
    }

    /**
     * Toggle serial connection
     */
    async toggleConnection() {
        if (this.serialReader.getConnectionStatus()) {
            await this.disconnect();
        } else {
            await this.connect();
        }
    }

    /**
     * Connect to serial port
     */
    async connect() {
        try {
            this.elements.connectBtn.disabled = true;
            await this.serialReader.connect();
        } catch (error) {
            console.error('Failed to connect:', error);
            this.showError(`Connection failed: ${error.message}`);
        } finally {
            this.elements.connectBtn.disabled = false;
        }
    }

    /**
     * Disconnect from serial port
     */
    async disconnect() {
        try {
            this.elements.connectBtn.disabled = true;
            await this.serialReader.disconnect();
        } catch (error) {
            console.error('Failed to disconnect:', error);
        } finally {
            this.elements.connectBtn.disabled = false;
        }
    }

    /**
     * Update connection status UI
     * @param {string} status - Connection status
     * @param {string} message - Status message
     */
    updateConnectionStatus(status, message) {
        // Update indicator
        this.elements.statusIndicator.className = 'status-indicator status-' + status;

        // Update text
        const statusTexts = {
            'connecting': 'Connecting...',
            'connected': 'Connected',
            'disconnected': 'Disconnected',
            'error': 'Error'
        };
        this.elements.statusText.textContent = statusTexts[status] || status;

        // Update button
        if (status === 'connected') {
            this.elements.connectBtn.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                Disconnect
            `;
        } else {
            this.elements.connectBtn.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
                Connect
            `;
        }

        // Show message if error
        if (status === 'error' && message) {
            this.showError(message);
        }
    }

    /**
     * Handle incoming data from serial port
     * @param {string} rawData - Raw data string
     */
    handleData(rawData) {
        try {
            // Parse data
            const data = this.parser.parse(rawData);

            // Validate
            if (!this.parser.validate(data)) {
                console.warn('Invalid data received');
                return;
            }

            // Update state
            this.lastReading = data;
            this.readingCount++;

            // Update UI
            this.updateUI(data);

            // Update chart
            this.updateChart(data);

            console.log('Reading processed:', data);
        } catch (error) {
            console.error('Error handling data:', error);
        }
    }

    /**
     * Update UI with new data
     * @param {Object} data - Parsed battery data
     */
    updateUI(data) {
        // Update total voltage
        this.elements.totalVoltage.textContent = this.parser.formatVoltage(data.totalVoltage);
        this.elements.cellCount.textContent = `${data.cellCount}S`;

        // Update cells grid
        this.updateCellsGrid(data.cells);

        // Update modules
        this.updateModules(data.modules);

        // Update footer
        this.elements.lastUpdate.textContent = this.parser.formatTimestamp(data.timestamp);
        this.elements.readingCount.textContent = this.readingCount.toString();
    }

    /**
     * Update cells grid display
     * @param {Array} cells - Array of cell objects
     */
    updateCellsGrid(cells) {
        // Filter out invalid cells (voltage <= 0.1V)
        const validCells = cells.filter(cell => cell.individualVoltage > 0.1);

        if (!validCells || validCells.length === 0) {
            this.elements.cellsGrid.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>No cells detected</p>
                </div>
            `;
            return;
        }

        this.elements.cellsGrid.innerHTML = validCells.map(cell => `
            <div class="cell-card">
                <span class="cell-label">${cell.name}</span>
                <div class="cell-voltage">
                    <span class="cell-voltage-value">${this.parser.formatVoltage(cell.individualVoltage)}</span>
                    <span class="cell-voltage-unit">V</span>
                </div>
                <span class="cell-status cell-status-${cell.status}">${cell.status}</span>
            </div>
        `).join('');
    }

    /**
     * Update modules display
     * @param {Array} modules - Array of module objects
     */
    updateModules(modules) {
        if (!modules || modules.length === 0) {
            this.elements.modulesContainer.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                    </svg>
                    <p>No modules detected</p>
                </div>
            `;
            return;
        }

        this.elements.modulesContainer.innerHTML = modules.map(module => `
            <div class="module-card">
                <div class="module-header">
                    <h3 class="module-title">Module ${module.id} (0x${module.address})</h3>
                </div>
                <div class="module-pins">
                    ${module.pins.map(pin => `
                        <div class="pin-item">
                            <span class="pin-label">${pin.pin} (${pin.cell})</span>
                            <span class="pin-value">
                                ${this.parser.formatVoltage(pin.voltage)}V
                                <span class="pin-raw">RAW: ${pin.raw}</span>
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    /**
     * Update chart with new data
     * @param {Object} data - Parsed battery data
     */
    updateChart(data) {
        const timestamp = this.parser.formatTimestamp(data.timestamp);

        // Prepare data for chart - use individual cell voltages
        const cellsData = {};
        for (const cell of data.cells) {
            // Only add valid voltages (> 0.1V to filter out disconnected cells)
            if (cell.individualVoltage > 0.1) {
                cellsData[cell.name] = cell.individualVoltage;
            }
        }

        // Update chart
        this.chartManager.updateCells(cellsData, timestamp);
    }

    /**
     * Clear chart data
     */
    clearChart() {
        this.chartManager.clear();
        console.log('Chart cleared');
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        // Simple console error for now
        // Could be enhanced with a toast notification system
        console.error(message);
        alert(message);
    }

    /**
     * Export current reading as JSON
     */
    exportJSON() {
        if (!this.lastReading) {
            this.showError('No data to export. Please connect and receive at least one reading.');
            return;
        }

        const json = this.parser.exportJSON(this.lastReading);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.downloadFile(`battery-reading-${timestamp}.json`, json, 'application/json');
        console.log('Exported current reading as JSON');
    }

    /**
     * Export current reading as CSV
     */
    exportCSV() {
        if (!this.lastReading) {
            this.showError('No data to export. Please connect and receive at least one reading.');
            return;
        }

        const csv = this.parser.exportCSV(this.lastReading);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.downloadFile(`battery-reading-${timestamp}.csv`, csv, 'text/csv');
        console.log('Exported current reading as CSV');
    }

    /**
     * Export chart history as JSON
     */
    exportHistoryJSON() {
        const historyData = this.chartManager.exportData();

        if (!historyData || historyData.labels.length === 0) {
            this.showError('No chart history to export. Please collect some data first.');
            return;
        }

        const json = JSON.stringify(historyData, null, 2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.downloadFile(`battery-history-${timestamp}.json`, json, 'application/json');
        console.log('Exported chart history as JSON');
    }

    /**
     * Export chart history as CSV
     */
    exportHistoryCSV() {
        const historyData = this.chartManager.exportData();

        if (!historyData || historyData.labels.length === 0) {
            this.showError('No chart history to export. Please collect some data first.');
            return;
        }

        // Build CSV
        const headers = ['Timestamp', ...historyData.datasets.map(ds => ds.label)];
        const rows = [headers];

        for (let i = 0; i < historyData.labels.length; i++) {
            const row = [historyData.labels[i]];
            for (const dataset of historyData.datasets) {
                row.push(dataset.data[i] !== undefined ? dataset.data[i].toFixed(3) : '');
            }
            rows.push(row);
        }

        const csv = rows.map(row => row.join(',')).join('\n');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.downloadFile(`battery-history-${timestamp}.csv`, csv, 'text/csv');
        console.log('Exported chart history as CSV');
    }

    /**
     * Export chart as image
     */
    exportChartImage() {
        try {
            const imageData = this.chartManager.exportAsImage();

            if (!imageData) {
                this.showError('Failed to export chart as image.');
                return;
            }

            // Convert base64 to blob and download
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const link = document.createElement('a');
            link.href = imageData;
            link.download = `battery-chart-${timestamp}.png`;
            link.click();
            console.log('Exported chart as image');
        } catch (error) {
            console.error('Error exporting chart image:', error);
            this.showError('Failed to export chart as image.');
        }
    }

    /**
     * Download file helper
     * @param {string} filename - File name
     * @param {string} content - File content
     * @param {string} mimeType - MIME type
     */
    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new BatteryMonitor());
} else {
    new BatteryMonitor();
}
