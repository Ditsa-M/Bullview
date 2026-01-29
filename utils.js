/**
 * Utility functions for DNA visualization
 */

/**
 * Maps color codes from topology to RGB colors
 */
export class ColorMapper {
    constructor() {
        // Color palette for different patch types
        this.colorPalette = {
            '-21': { r: 0.2, g: 0.6, b: 1.0 },   // Blue (negative patch)
            '21': { r: 1.0, g: 0.3, b: 0.3 },     // Red (positive patch)
            '100': { r: 0.7, g: 0.7, b: 0.7 },    // Gray (blank/neutral)
        };

        // Generate colors for other values using gradient
        this.generateGradient();
    }

    generateGradient() {
        // Generate colors for values from -100 to 100
        for (let i = -100; i <= 100; i++) {
            const key = i.toString();
            if (!this.colorPalette[key]) {
                const normalized = (i + 100) / 200; // 0 to 1
                this.colorPalette[key] = this.hslToRgb(normalized * 0.8, 0.7, 0.6);
            }
        }
    }

    hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return { r, g, b };
    }

    getColor(colorCode) {
        const key = colorCode.toString();
        return this.colorPalette[key] || this.colorPalette['100'];
    }

    getColor3(colorCode) {
        const color = this.getColor(colorCode);
        return new BABYLON.Color3(color.r, color.g, color.b);
    }

    getColor4(colorCode, alpha = 1.0) {
        const color = this.getColor(colorCode);
        return new BABYLON.Color4(color.r, color.g, color.b, alpha);
    }
}

/**
 * Vector and orientation utilities
 */
export class VectorUtils {
    /**
     * Create orientation matrix from base and normal vectors
     * a1 = base vector, a3 = normal vector, a2 = a3 × a1
     */
    static createOrientationMatrix(a1, a3) {
        const a2 = BABYLON.Vector3.Cross(a3, a1);

        return BABYLON.Matrix.FromValues(
            a1.x, a1.y, a1.z, 0,
            a2.x, a2.y, a2.z, 0,
            a3.x, a3.y, a3.z, 0,
            0, 0, 0, 1
        );
    }

    /**
     * Calculate patch position relative to particle center
     */
    static calculatePatchPosition(particlePos, patchLocalPos, orientationMatrix) {
        const localPos = new BABYLON.Vector3(patchLocalPos.x, patchLocalPos.y, patchLocalPos.z);
        const rotatedPos = BABYLON.Vector3.TransformCoordinates(localPos, orientationMatrix);
        return particlePos.add(rotatedPos);
    }

    /**
     * Calculate center of mass for a set of positions
     */
    static calculateCenterOfMass(positions) {
        if (positions.length === 0) return new BABYLON.Vector3(0, 0, 0);

        const sum = positions.reduce((acc, pos) => acc.add(pos), new BABYLON.Vector3(0, 0, 0));
        return sum.scale(1 / positions.length);
    }

    /**
     * Calculate bounding box for positions
     */
    static calculateBoundingBox(positions) {
        if (positions.length === 0) {
            return { min: new BABYLON.Vector3(0, 0, 0), max: new BABYLON.Vector3(0, 0, 0) };
        }

        const min = new BABYLON.Vector3(
            Math.min(...positions.map(p => p.x)),
            Math.min(...positions.map(p => p.y)),
            Math.min(...positions.map(p => p.z))
        );

        const max = new BABYLON.Vector3(
            Math.max(...positions.map(p => p.x)),
            Math.max(...positions.map(p => p.y)),
            Math.max(...positions.map(p => p.z))
        );

        return { min, max };
    }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
    constructor() {
        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.updateInterval = 500; // Update every 500ms
    }

    update() {
        this.frameCount++;
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;

        if (deltaTime >= this.updateInterval) {
            this.fps = Math.round((this.frameCount * 1000) / deltaTime);
            this.frameCount = 0;
            this.lastTime = currentTime;
        }

        return this.fps;
    }

    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
                total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) // MB
            };
        }
        return null;
    }
}

/**
 * Level of Detail calculator
 */
export class LODCalculator {
    constructor(thresholds = { high: 20, medium: 50, low: 100 }) {
        this.thresholds = thresholds;
    }

    /**
     * Get LOD level based on distance from camera
     * @param {number} distance - Distance from camera
     * @returns {string} - 'high', 'medium', 'low', or 'hidden'
     */
    getLODLevel(distance) {
        if (distance < this.thresholds.high) return 'high';
        if (distance < this.thresholds.medium) return 'medium';
        if (distance < this.thresholds.low) return 'low';
        return 'hidden';
    }

    /**
     * Get subdivision level for spheres based on LOD
     */
    getSubdivisions(lodLevel) {
        switch (lodLevel) {
            case 'high': return 16;
            case 'medium': return 8;
            case 'low': return 4;
            default: return 2;
        }
    }
}

/**
 * File utilities
 */
export class FileUtils {
    /**
     * Read file as text
     */
    static readAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    /**
     * Download data as file
     */
    static downloadFile(data, filename, mimeType) {
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Download blob as file
     */
    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}
