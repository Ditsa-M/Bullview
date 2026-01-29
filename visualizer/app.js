/**
 * Main application controller
 */

import { TopologyParser, ConfigurationParser, DataCombiner } from './parsers.js';
import { DNARenderer } from './renderer.js';
import { InteractionManager } from './interactions.js';
import { Exporter } from './exporter.js';
import { PerformanceMonitor, FileUtils } from './utils.js';

export class DNAVisualizerApp {
    constructor() {
        this.topologyData = null;
        this.configurationData = null;
        this.combinedData = null;

        this.renderer = null;
        this.interactionManager = null;
        this.exporter = null;
        this.performanceMonitor = new PerformanceMonitor();

        this.topologyParser = new TopologyParser();
        this.configurationParser = new ConfigurationParser();

        this.ui = {
            canvas: null,
            dropZone: null,
            infoPanel: null,
            statsPanel: null,
            controls: null
        };
    }

    /**
     * Initialize the application
     */
    async init() {
        // Get UI elements
        this.ui.canvas = document.getElementById('renderCanvas');
        this.ui.dropZone = document.getElementById('dropZone');
        this.ui.infoPanel = document.getElementById('infoPanel');
        this.ui.statsPanel = document.getElementById('statsPanel');
        this.ui.controls = document.getElementById('controls');

        // Initialize renderer
        this.renderer = new DNARenderer(this.ui.canvas);
        await this.renderer.init();

        // Initialize interaction manager
        this.interactionManager = new InteractionManager(this.renderer);
        this.interactionManager.onSelectionChanged = (selectedIndices) => {
            this.updateSelectionInfo(selectedIndices);
        };
        this.interactionManager.onHoverChanged = (particle) => {
            this.updateHoverInfo(particle);
        };

        // Initialize exporter
        this.exporter = new Exporter(this.renderer);

        // Setup drag and drop
        this.setupDragAndDrop();

        // Setup controls
        this.setupControls();

        // Start performance monitoring
        this.startPerformanceMonitoring();

        console.log('DNA Visualizer initialized');
    }

    /**
     * Setup drag and drop functionality
     */
    setupDragAndDrop() {
        const dropZone = this.ui.dropZone;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', async (e) => {
            const files = Array.from(e.dataTransfer.files);
            await this.handleFiles(files);
        });

        // Also allow file input
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            await this.handleFiles(files);
        });
    }

    /**
     * Handle dropped/selected files
     */
    async handleFiles(files) {
        for (const file of files) {
            const ext = file.name.split('.').pop().toLowerCase();
            const content = await FileUtils.readAsText(file);

            try {
                if (ext === 'psp') {
                    this.topologyData = this.topologyParser.parse(content);
                    this.showMessage(`Loaded topology: ${file.name}`, 'success');
                } else if (ext === 'dat') {
                    this.configurationData = this.configurationParser.parse(content);
                    this.showMessage(`Loaded configuration: ${file.name}`, 'success');
                }
            } catch (error) {
                this.showMessage(`Error parsing ${file.name}: ${error.message}`, 'error');
                console.error(error);
            }
        }

        // If we have both files, visualize
        if (this.topologyData && this.configurationData) {
            this.visualize();
        }
    }

    /**
     * Visualize the loaded data
     */
    visualize() {
        try {
            // Combine topology and configuration
            this.combinedData = DataCombiner.combine(this.topologyData, this.configurationData);

            // Load into renderer
            this.renderer.loadData(this.combinedData);

            // Hide drop zone
            this.ui.dropZone.style.display = 'none';

            // Update info panel
            this.updateInfoPanel();

            this.showMessage('DNA structure loaded successfully!', 'success');
        } catch (error) {
            this.showMessage(`Error visualizing: ${error.message}`, 'error');
            console.error(error);
        }
    }

    /**
     * Setup control buttons
     */
    setupControls() {
        // Export image button
        document.getElementById('exportImageBtn').addEventListener('click', async () => {
            this.showMessage('Exporting image...', 'info');
            const success = await this.exporter.exportImage();
            if (success) {
                this.showMessage('Image exported successfully!', 'success');
            } else {
                this.showMessage('Failed to export image', 'error');
            }
        });

        // Export video button
        document.getElementById('exportVideoBtn').addEventListener('click', async () => {
            this.showMessage('Recording video (5 seconds)...', 'info');
            const success = await this.exporter.recordVideo(5000);
            if (success) {
                this.showMessage('Video exported successfully!', 'success');
            } else {
                this.showMessage('Failed to export video', 'error');
            }
        });

        // Clear selection button
        document.getElementById('clearSelectionBtn').addEventListener('click', () => {
            this.interactionManager.clearSelection();
        });

        // Reset camera button
        document.getElementById('resetCameraBtn').addEventListener('click', () => {
            if (this.combinedData) {
                const positions = this.combinedData.particles.map(p => p.position);
                const center = positions.reduce((acc, pos) => acc.add(pos), new BABYLON.Vector3(0, 0, 0))
                    .scale(1 / positions.length);
                this.renderer.camera.target = center;
                this.renderer.camera.alpha = Math.PI / 2;
                this.renderer.camera.beta = Math.PI / 3;
            }
        });

        // Load example files button
        document.getElementById('loadExampleBtn').addEventListener('click', async () => {
            await this.loadExampleFiles();
        });
    }

    /**
     * Load example files
     */
    async loadExampleFiles() {
        try {
            this.showMessage('Loading example files...', 'info');

            const [topologyResponse, configResponse] = await Promise.all([
                fetch('../Example/input.psp'),
                fetch('../Example/input.dat')
            ]);

            const topologyContent = await topologyResponse.text();
            const configContent = await configResponse.text();

            this.topologyData = this.topologyParser.parse(topologyContent);
            this.configurationData = this.configurationParser.parse(configContent);

            this.visualize();
        } catch (error) {
            this.showMessage('Failed to load example files. Please use drag and drop.', 'error');
            console.error(error);
        }
    }

    /**
     * Update info panel
     */
    updateInfoPanel() {
        if (!this.combinedData) return;

        const info = document.getElementById('structureInfo');
        info.innerHTML = `
            <h3>Structure Information</h3>
            <p><strong>Particles:</strong> ${this.combinedData.particles.length}</p>
            <p><strong>Bonds:</strong> ${this.combinedData.bonds.length}</p>
            <p><strong>Strands:</strong> ${this.combinedData.metadata.numStrands}</p>
            <p><strong>Timestep:</strong> ${this.combinedData.metadata.timestep}</p>
            <p><strong>Box:</strong> ${this.combinedData.metadata.box.x.toFixed(1)} × 
                ${this.combinedData.metadata.box.y.toFixed(1)} × 
                ${this.combinedData.metadata.box.z.toFixed(1)}</p>
        `;
    }

    /**
     * Update selection info
     */
    updateSelectionInfo(selectedIndices) {
        const selectionInfo = document.getElementById('selectionInfo');

        if (selectedIndices.length === 0) {
            selectionInfo.innerHTML = '<p>No particles selected</p>';
            return;
        }

        const particles = selectedIndices.map(idx => this.combinedData.particles[idx]);

        let html = `<h3>Selected Particles (${selectedIndices.length})</h3>`;
        particles.slice(0, 5).forEach(particle => {
            html += `
                <div class="particle-info">
                    <p><strong>Index:</strong> ${particle.index}</p>
                    <p><strong>Strand:</strong> ${particle.strand}</p>
                    <p><strong>Type:</strong> ${particle.type}</p>
                    <p><strong>Position:</strong> (${particle.position.x.toFixed(2)}, 
                        ${particle.position.y.toFixed(2)}, ${particle.position.z.toFixed(2)})</p>
                </div>
            `;
        });

        if (particles.length > 5) {
            html += `<p><em>... and ${particles.length - 5} more</em></p>`;
        }

        selectionInfo.innerHTML = html;
    }

    /**
     * Update hover info
     */
    updateHoverInfo(particle) {
        // Could show tooltip or update UI
        if (particle) {
            this.ui.canvas.style.cursor = 'pointer';
        } else {
            this.ui.canvas.style.cursor = 'default';
        }
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        setInterval(() => {
            const fps = this.performanceMonitor.update();
            const memory = this.performanceMonitor.getMemoryUsage();

            let statsHTML = `<strong>FPS:</strong> ${fps}`;

            if (memory) {
                statsHTML += ` | <strong>Memory:</strong> ${memory.used}MB / ${memory.total}MB`;
            }

            this.ui.statsPanel.innerHTML = statsHTML;
        }, 500);
    }

    /**
     * Show message to user
     */
    showMessage(message, type = 'info') {
        const messageDiv = document.getElementById('message');
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

// Initialize app when DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
    const app = new DNAVisualizerApp();
    await app.init();

    // Make app globally accessible for debugging
    window.dnaApp = app;
});
