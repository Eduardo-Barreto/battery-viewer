/**
 * ChartManager - Module for managing Chart.js voltage history charts
 * Handles chart creation, updates, and styling
 */

export class ChartManager {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.chart = null;
        this.maxDataPoints = 50; // Maximum points to show in chart
        this.datasets = new Map(); // Map of cell name to dataset
        this.labels = []; // Time labels
        this.colors = this.generateColors();
        this.colorIndex = 0;

        this.initChart();
    }

    /**
     * Generate a palette of distinct colors for cells
     * @returns {Array} Array of color strings
     */
    generateColors() {
        return [
            'rgba(47, 129, 247, 1)',   // Blue
            'rgba(63, 185, 80, 1)',    // Green
            'rgba(210, 153, 34, 1)',   // Yellow
            'rgba(248, 81, 73, 1)',    // Red
            'rgba(163, 113, 247, 1)',  // Purple
            'rgba(242, 130, 37, 1)',   // Orange
            'rgba(31, 199, 212, 1)',   // Cyan
            'rgba(255, 115, 179, 1)',  // Pink
            'rgba(139, 233, 139, 1)',  // Light green
            'rgba(255, 205, 86, 1)',   // Light yellow
        ];
    }

    /**
     * Get next color from palette
     * @returns {string} Color string
     */
    getNextColor() {
        const color = this.colors[this.colorIndex % this.colors.length];
        this.colorIndex++;
        return color;
    }

    /**
     * Initialize Chart.js instance with dark theme
     */
    initChart() {
        const ctx = this.canvas.getContext('2d');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.labels,
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#e6edf3',
                            font: {
                                family: 'ui-monospace, SFMono-Regular, monospace',
                                size: 11
                            },
                            padding: 12,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(13, 17, 23, 0.95)',
                        titleColor: '#e6edf3',
                        bodyColor: '#8d96a0',
                        borderColor: '#30363d',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y.toFixed(3);
                                return ` ${label}: ${value}V`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time',
                            color: '#8d96a0',
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        },
                        ticks: {
                            color: '#6e7681',
                            maxRotation: 0,
                            autoSkipPadding: 20,
                            font: {
                                size: 10
                            }
                        },
                        grid: {
                            color: '#21262d',
                            drawBorder: false
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Voltage (V)',
                            color: '#8d96a0',
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        },
                        ticks: {
                            color: '#6e7681',
                            font: {
                                size: 10
                            },
                            callback: (value) => value.toFixed(2) + 'V'
                        },
                        grid: {
                            color: '#21262d',
                            drawBorder: false
                        },
                        beginAtZero: true
                    }
                },
                elements: {
                    line: {
                        tension: 0.4,
                        borderWidth: 2
                    },
                    point: {
                        radius: 0,
                        hitRadius: 10,
                        hoverRadius: 4
                    }
                },
                animation: {
                    duration: 300
                }
            }
        });
    }

    /**
     * Add or update data point for a cell
     * @param {string} cellName - Cell identifier (e.g., '1S', '2S')
     * @param {number} voltage - Voltage value
     * @param {string} timestamp - Time label
     */
    addDataPoint(cellName, voltage, timestamp) {
        // Add timestamp to labels if new
        if (!this.labels.includes(timestamp)) {
            this.labels.push(timestamp);

            // Trim labels if exceeding max
            if (this.labels.length > this.maxDataPoints) {
                this.labels.shift();
            }
        }

        // Get or create dataset for this cell
        let dataset = this.datasets.get(cellName);

        if (!dataset) {
            const color = this.getNextColor();
            dataset = {
                label: cellName,
                data: [],
                borderColor: color,
                backgroundColor: color.replace('1)', '0.1)'),
                fill: false
            };
            this.datasets.set(cellName, dataset);
            this.chart.data.datasets.push(dataset);
        }

        // Add data point
        dataset.data.push(voltage);

        // Trim data if exceeding max
        if (dataset.data.length > this.maxDataPoints) {
            dataset.data.shift();
        }

        // Update chart
        this.chart.update('none'); // 'none' for no animation on updates
    }

    /**
     * Update multiple cells at once
     * @param {Object} cellsData - Object with cell names as keys and voltages as values
     * @param {string} timestamp - Time label
     */
    updateCells(cellsData, timestamp) {
        // Add timestamp
        this.labels.push(timestamp);
        if (this.labels.length > this.maxDataPoints) {
            this.labels.shift();
        }

        // Update each cell
        for (const [cellName, voltage] of Object.entries(cellsData)) {
            let dataset = this.datasets.get(cellName);

            if (!dataset) {
                const color = this.getNextColor();
                dataset = {
                    label: cellName,
                    data: [],
                    borderColor: color,
                    backgroundColor: color.replace('1)', '0.1)'),
                    fill: false
                };
                this.datasets.set(cellName, dataset);
                this.chart.data.datasets.push(dataset);
            }

            dataset.data.push(voltage);

            if (dataset.data.length > this.maxDataPoints) {
                dataset.data.shift();
            }
        }

        // Update chart once
        this.chart.update('none');
    }

    /**
     * Clear all chart data
     */
    clear() {
        this.labels = [];
        this.datasets.clear();
        this.chart.data.labels = [];
        this.chart.data.datasets = [];
        this.colorIndex = 0;
        this.chart.update();
    }

    /**
     * Destroy chart instance
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    /**
     * Update chart options
     * @param {Object} options - Chart.js options object
     */
    updateOptions(options) {
        Object.assign(this.chart.options, options);
        this.chart.update();
    }

    /**
     * Set maximum number of data points to display
     * @param {number} max - Maximum data points
     */
    setMaxDataPoints(max) {
        this.maxDataPoints = max;
    }

    /**
     * Export chart as image
     * @returns {string} Base64 encoded image
     */
    exportAsImage() {
        return this.chart.toBase64Image();
    }
}
