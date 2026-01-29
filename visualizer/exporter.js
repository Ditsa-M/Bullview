/**
 * Export functionality for images and videos
 */

import { FileUtils } from './utils.js';

export class Exporter {
    constructor(renderer) {
        this.renderer = renderer;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
    }

    /**
     * Export current view as PNG image
     */
    async exportImage(filename = 'dna_structure.png', width = 1920, height = 1080) {
        try {
            const dataUrl = await this.renderer.exportImage(width, height);

            // Convert data URL to blob and download
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            FileUtils.downloadBlob(blob, filename);

            return true;
        } catch (error) {
            console.error('Error exporting image:', error);
            return false;
        }
    }

    /**
     * Start recording video
     */
    async startRecording(options = {}) {
        if (this.isRecording) {
            console.warn('Already recording');
            return false;
        }

        try {
            const canvas = this.renderer.canvas;
            const stream = canvas.captureStream(30); // 30 FPS

            this.recordedChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 5000000 // 5 Mbps
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.start();
            this.isRecording = true;

            // Optional: auto-rotate camera during recording
            if (options.autoRotate) {
                this.startAutoRotation(options.rotationSpeed || 0.01);
            }

            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            return false;
        }
    }

    /**
     * Stop recording and download video
     */
    async stopRecording(filename = 'dna_structure.webm') {
        if (!this.isRecording) {
            console.warn('Not recording');
            return false;
        }

        return new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                FileUtils.downloadBlob(blob, filename);

                this.isRecording = false;
                this.mediaRecorder = null;
                this.recordedChunks = [];
                this.stopAutoRotation();

                resolve(true);
            };

            this.mediaRecorder.stop();
        });
    }

    /**
     * Record a fixed duration video with auto-rotation
     */
    async recordVideo(duration = 5000, filename = 'dna_structure.webm') {
        await this.startRecording({ autoRotate: true, rotationSpeed: 0.005 });

        return new Promise((resolve) => {
            setTimeout(async () => {
                await this.stopRecording(filename);
                resolve(true);
            }, duration);
        });
    }

    /**
     * Start auto-rotation of camera
     */
    startAutoRotation(speed = 0.01) {
        if (!this.renderer.scene) return;

        this.autoRotationObserver = this.renderer.scene.onBeforeRenderObservable.add(() => {
            this.renderer.camera.alpha += speed;
        });
    }

    /**
     * Stop auto-rotation of camera
     */
    stopAutoRotation() {
        if (this.autoRotationObserver && this.renderer.scene) {
            this.renderer.scene.onBeforeRenderObservable.remove(this.autoRotationObserver);
            this.autoRotationObserver = null;
        }
    }

    /**
     * Export structure data as JSON
     */
    exportDataAsJSON(filename = 'dna_data.json') {
        if (!this.renderer.data) {
            console.warn('No data to export');
            return false;
        }

        // Convert to serializable format
        const exportData = {
            metadata: this.renderer.data.metadata,
            particles: this.renderer.data.particles.map(p => ({
                index: p.index,
                type: p.type,
                strand: p.strand,
                radius: p.radius,
                position: { x: p.position.x, y: p.position.y, z: p.position.z },
                patches: p.patches
            })),
            bonds: this.renderer.data.bonds
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        FileUtils.downloadFile(jsonString, filename, 'application/json');

        return true;
    }
}
