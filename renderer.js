/**
 * Babylon.js 3D renderer for DNA structures
 */

import { ColorMapper, VectorUtils, LODCalculator } from './utils.js';

export class DNARenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.data = null;

        this.colorMapper = new ColorMapper();
        this.lodCalculator = new LODCalculator();

        // Instance management
        this.nucleotideInstances = [];
        this.bondMeshes = [];
        this.bondMeshes = [];
        this.patchMeshes = [];
        this.bondMeshes = [];
        this.patchMeshes = [];
        this.selectionMeshes = new Map();
        this.boxMesh = null;

        // PBC and Interaction State
        this.boxOffset = new BABYLON.Vector3(0, 0, 0);
        this.originalParticlePositions = []; // Store source truth

        // Materials
        this.nucleotideMaterial = null;
        this.bondMaterial = null;
        this.selectedMaterial = null;

        this.initialized = false;
    }

    /**
     * Initialize the Babylon.js engine and scene
     */
    async init() {
        // Create engine
        this.engine = new BABYLON.Engine(this.canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
            disableWebGL2Support: false
        });

        // Create scene
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.08, 1.0);

        // Enable optimizations
        this.scene.autoClear = true;
        this.scene.autoClearDepthAndStencil = true;
        this.scene.blockMaterialDirtyMechanism = true;

        // Create camera
        this.camera = new BABYLON.ArcRotateCamera(
            'camera',
            Math.PI / 2,
            Math.PI / 3,
            50,
            BABYLON.Vector3.Zero(),
            this.scene
        );
        this.camera.attachControl(this.canvas, true);
        this.camera.wheelPrecision = 50;
        this.camera.minZ = 0.1;
        this.camera.maxZ = 10000;
        this.camera.lowerRadiusLimit = 5;
        this.camera.upperRadiusLimit = 1000;
        this.camera.panningSensibility = 50;

        // Create lights
        const hemiLight = new BABYLON.HemisphericLight(
            'hemiLight',
            new BABYLON.Vector3(0, 1, 0),
            this.scene
        );
        hemiLight.intensity = 0.6;

        const dirLight = new BABYLON.DirectionalLight(
            'dirLight',
            new BABYLON.Vector3(-1, -2, -1),
            this.scene
        );
        dirLight.intensity = 0.8;

        // Create materials
        this.createMaterials();

        // Start render loop
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        // Handle resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });

        this.initialized = true;
    }

    /**
     * Create materials for nucleotides and bonds
     */
    createMaterials() {
        // Nucleotide material (PBR for realistic look)
        this.nucleotideMaterial = new BABYLON.PBRMaterial('nucleotideMat', this.scene);
        this.nucleotideMaterial.metallic = 0.0;
        this.nucleotideMaterial.roughness = 0.4;
        this.nucleotideMaterial.alpha = 1.0;

        // Bond material (standard for performance)
        this.bondMaterial = new BABYLON.StandardMaterial('bondMat', this.scene);
        this.bondMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
        this.bondMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        this.bondMaterial.alpha = 0.8;

        // Selected/highlighted material
        this.selectedMaterial = new BABYLON.StandardMaterial('selectedMat', this.scene);
        this.selectedMaterial.emissiveColor = new BABYLON.Color3(1.0, 0.8, 0.0);
        this.selectedMaterial.diffuseColor = new BABYLON.Color3(1.0, 0.9, 0.3);
        this.selectedMaterial.specularColor = new BABYLON.Color3(1.0, 1.0, 1.0);
    }

    /**
     * Load and render DNA structure data
     */
    loadData(combinedData) {
        this.data = combinedData;

        // Clear existing meshes
        this.clearScene();

        // Reset offset
        this.boxOffset = new BABYLON.Vector3(0, 0, 0);

        // Store original positions for PBC calculations
        this.originalParticlePositions = combinedData.particles.map(p => p.position.clone());

        // Calculate center and adjust camera
        const positions = combinedData.particles.map(p => p.position);
        const center = VectorUtils.calculateCenterOfMass(positions);
        const bbox = VectorUtils.calculateBoundingBox(positions);
        const size = bbox.max.subtract(bbox.min);
        const maxDim = Math.max(size.x, size.y, size.z);

        this.camera.target = center;
        this.camera.radius = maxDim * 2;

        // Render particles and bonds
        this.renderNucleotides(combinedData.particles);
        this.renderBonds(combinedData.bonds, combinedData.particles);

        // Render bounding box
        if (combinedData.metadata && combinedData.metadata.box) {
            this.renderBoundingBox(combinedData.metadata.box);
        }

        console.log(`Loaded ${combinedData.particles.length} particles and ${combinedData.bonds.length} bonds`);
    }

    /**
     * Render nucleotides using GPU instancing
     */
    renderNucleotides(particles) {
        if (particles.length === 0) return;

        // Group particles by strand to use different colors
        const strandGroups = {};
        particles.forEach(particle => {
            if (!strandGroups[particle.strand]) {
                strandGroups[particle.strand] = [];
            }
            strandGroups[particle.strand].push(particle);
        });

        // Create instances for each strand
        Object.keys(strandGroups).forEach((strandId, strandIndex) => {
            const strandParticles = strandGroups[strandId];

            // Create base sphere (will be instanced)
            const baseSphere = BABYLON.MeshBuilder.CreateSphere(
                `nucleotide_strand_${strandId}`,
                { diameter: 1, segments: 12 },
                this.scene
            );

            // Create material for this strand
            const material = new BABYLON.PBRMaterial(`strandMat_${strandId}`, this.scene);
            material.metallic = 0.0;
            material.roughness = 0.4;

            // Use color based on strand or patches
            const particleColor = this.getParticleColor(strandParticles[0], strandIndex);
            material.albedoColor = particleColor;

            baseSphere.material = material;

            // IMPORTANT: Disable source mesh but keep it for instancing
            baseSphere.isVisible = false;

            // Create instances - treat ALL particles as instances of the invisible source
            strandParticles.forEach(particle => {
                const instance = baseSphere.createInstance(`nucleotide_${particle.index}`);

                instance.position = particle.position.clone();
                instance.scaling = new BABYLON.Vector3(
                    particle.radius,
                    particle.radius,
                    particle.radius
                );

                // Store particle data for selection
                instance.metadata = { particle };

                this.nucleotideInstances.push(instance);
            });
        });
    }

    /**
     * Get color for a particle based on patches or strand
     */
    getParticleColor(particle, strandIndex) {
        // Try to get color from first patch
        if (particle.patches && particle.patches.length > 0) {
            const firstPatch = particle.patches[0];
            return this.colorMapper.getColor3(firstPatch.color);
        }

        // Otherwise use strand-based color
        const hue = (strandIndex * 0.618033988749895) % 1.0; // Golden ratio for color distribution
        return BABYLON.Color3.FromHSV(hue * 360, 0.7, 0.9);
    }

    /**
     * Render bonds between nucleotides
     */
    renderBonds(bonds, particles) {
        if (bonds.length === 0) return;

        // Use a single line system for all bonds for better performance
        const points = [];
        const colors = [];

        bonds.forEach(bond => {
            const fromParticle = particles[bond.from];
            const toParticle = particles[bond.to];

            if (fromParticle && toParticle) {
                points.push([fromParticle.position, toParticle.position]);

                // Color based on spring properties if available
                const color = new BABYLON.Color4(0.5, 0.5, 0.5, 0.6);
                colors.push([color, color]);
            }
        });

        // Create line system
        if (points.length > 0) {
            const lineSystem = BABYLON.MeshBuilder.CreateLineSystem(
                'bonds',
                { lines: points, colors: colors },
                this.scene
            );
            lineSystem.isPickable = false;
            this.bondMeshes.push(lineSystem);
        }
        if (points.length > 0) {
            const lineSystem = BABYLON.MeshBuilder.CreateLineSystem(
                'bonds',
                { lines: points, colors: colors },
                this.scene
            );
            lineSystem.isPickable = false;
            this.bondMeshes.push(lineSystem);
        }
    }

    /**
     * Render simulation bounding box
     */
    renderBoundingBox(box) {
        if (!box) return;

        // Create box mesh
        this.boxMesh = BABYLON.MeshBuilder.CreateBox('simulationBox', {
            width: box.x,
            height: box.y,
            depth: box.z
        }, this.scene);

        // Position at center (0 to L) => center at L/2
        this.boxMesh.position = new BABYLON.Vector3(box.x / 2, box.y / 2, box.z / 2);

        // Create wireframe material
        const material = new BABYLON.StandardMaterial('boxMat', this.scene);
        material.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0);
        material.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        material.wireframe = true;
        material.disableLighting = true;

        this.boxMesh.material = material;
        this.boxMesh.isPickable = false;
    }

    /**
     * Clear all meshes from scene
     */
    clearScene() {
        // Dispose nucleotide instances
        this.nucleotideInstances.forEach(instance => instance.dispose());
        this.nucleotideInstances = [];

        // Dispose bonds
        this.bondMeshes.forEach(mesh => mesh.dispose());
        this.bondMeshes = [];

        // Dispose patches
        this.patchMeshes.forEach(mesh => mesh.dispose());
        this.patchMeshes = [];

        // Dispose selection meshes
        this.selectionMeshes.forEach(mesh => mesh.dispose());
        this.selectionMeshes.clear();

        // Dispose box mesh
        if (this.boxMesh) {
            this.boxMesh.dispose();
            this.boxMesh = null;
        }
    }

    /**
     * Highlight selected nucleotide
     */
    highlightNucleotide(particleIndex, highlight = true) {
        // If unhighlighting
        if (!highlight) {
            const mesh = this.selectionMeshes.get(particleIndex);
            if (mesh) {
                mesh.dispose();
                this.selectionMeshes.delete(particleIndex);
            }
            return;
        }

        // If already highlighted, do nothing
        if (this.selectionMeshes.has(particleIndex)) return;

        // Find the particle instance to get position
        const instance = this.nucleotideInstances.find(
            inst => inst.metadata && inst.metadata.particle.index === particleIndex
        );

        if (instance) {
            // Create a proxy mesh for the highlight
            const highlightMesh = BABYLON.MeshBuilder.CreateSphere(
                `highlight_${particleIndex}`,
                { diameter: 1, segments: 12 },
                this.scene
            );

            // Match position and scale
            highlightMesh.position = instance.position.clone();
            highlightMesh.scaling = instance.scaling.clone();

            // Make invisible but render outline
            // We need a dummy material to avoid default white
            const invisibleMat = new BABYLON.StandardMaterial(`invisibleMat_${particleIndex}`, this.scene);
            invisibleMat.alpha = 0;
            highlightMesh.material = invisibleMat;

            highlightMesh.renderOutline = true;
            highlightMesh.outlineColor = new BABYLON.Color3(1, 0.8, 0); // Yellow
            highlightMesh.outlineWidth = 0.1;

            // Prevent picking the highlight mesh itself
            highlightMesh.isPickable = false;

            this.selectionMeshes.set(particleIndex, highlightMesh);
        }
    }

    /**
     * Get particle at screen position (for picking)
     */
    pickParticle(x, y) {
        const pickInfo = this.scene.pick(x, y, mesh => {
            return this.nucleotideInstances.includes(mesh);
        });

        if (pickInfo.hit && pickInfo.pickedMesh && pickInfo.pickedMesh.metadata) {
            return pickInfo.pickedMesh.metadata.particle;
        }

        return null;
    }

    /**
     * Export current view as image
     */
    async exportImage(width = 1920, height = 1080) {
        return new Promise((resolve) => {
            BABYLON.Tools.CreateScreenshot(this.engine, this.camera, { width, height }, (data) => {
                resolve(data);
            });
        });
    }

    /**
     * Set camera speed properties
     * speed: 1-100
     */
    setCameraSpeed(speed) {
        if (!this.camera) return;

        // Base values
        const basePanning = 50;
        const baseWheel = 50;

        // Calculate multipliers (speed 50 is default/1x)
        const factor = speed / 50;

        this.camera.panningSensibility = basePanning / factor; // Higher sensibility value = slower speed
        this.camera.wheelPrecision = baseWheel / factor; // Higher precision = slower speed
        this.camera.angularSensibilityX = 1000 / factor;
        this.camera.angularSensibilityY = 1000 / factor;
    }

    /**
     * Shift particles (move box state)
     */
    shiftParticles(axis, amount) {
        if (!this.data || !this.data.metadata.box) return;

        if (axis === 'x') this.boxOffset.x += amount;
        if (axis === 'y') this.boxOffset.y += amount;
        if (axis === 'z') this.boxOffset.z += amount;

        this.updateParticlePositions();
    }

    /**
     * Update particle positions based on PBC and offset
     */
    updateParticlePositions() {
        if (!this.data || !this.data.metadata.box) return;

        const box = this.data.metadata.box;

        // Helper for wrapping
        const wrap = (val, max) => {
            let res = val % max;
            if (res < 0) res += max;
            return res;
        };

        // Update each particle instance
        this.nucleotideInstances.forEach((instance, i) => {
            const originalPos = this.originalParticlePositions[i];

            // Calculate new position
            const newX = wrap(originalPos.x + this.boxOffset.x, box.x);
            const newY = wrap(originalPos.y + this.boxOffset.y, box.y);
            const newZ = wrap(originalPos.z + this.boxOffset.z, box.z);

            instance.position.x = newX;
            instance.position.y = newY;
            instance.position.z = newZ;

            // Update associated selection mesh if exists
            const particleIndex = instance.metadata.particle.index;
            if (this.selectionMeshes.has(particleIndex)) {
                const selMesh = this.selectionMeshes.get(particleIndex);
                selMesh.position.copyFrom(instance.position);
            }
        });

        // Update bond positions
        // We need to rebuild the line system or update its vertices
        if (this.bondMeshes.length > 0) {
            // Gather new points
            const points = [];
            this.data.bonds.forEach(bond => {
                const fromParticle = this.nucleotideInstances.find(inst => inst.metadata.particle.index === bond.from);
                const toParticle = this.nucleotideInstances.find(inst => inst.metadata.particle.index === bond.to);

                if (fromParticle && toParticle) {
                    points.push([fromParticle.position, toParticle.position]);
                }
            });

            // We have multiple line systems (one per batch of lines usually, but here we made all in one go or multiple)
            // The renderBonds function creates one or more meshes.
            // Simplest way: dispose old bonds and create new ones. Updating LineSystem instance is complex if topology differs (it shouldn't here but easier to just recreate for reliability first).
            // Actually, LineSystem update is efficient. Let's try to update the first one if it exists, assuming all bonds are in one mesh (which they are in renderBonds unless huge).

            // Re-creating is safer to avoid "lines mismatch" errors if logic was complex.
            // Let's defer to clearing and re-rendering bonds.
            this.bondMeshes.forEach(m => m.dispose());
            this.bondMeshes = [];

            // Re-render bonds with current positions
            // We can't reuse renderBonds easily because it uses original data which has original positions.
            // We need to use the INSTANCE positions.

            const colors = [];
            // Re-create points array from current instance positions
            this.data.bonds.forEach(bond => {
                const colorsForBond = [];
                const color = new BABYLON.Color4(0.5, 0.5, 0.5, 0.6);
                colors.push([color, color]);
            });

            if (points.length > 0) {
                const lineSystem = BABYLON.MeshBuilder.CreateLineSystem(
                    'bonds',
                    { lines: points, colors: colors, updatable: true },
                    this.scene
                );
                lineSystem.isPickable = false;
                this.bondMeshes.push(lineSystem);
            }
        }
    }

    /**
     * Set simulation box visibility
     */
    setBoxVisibility(visible) {
        if (this.boxMesh) {
            this.boxMesh.isVisible = visible;
        }
    }

    /**
     * Dispose renderer
     */
    dispose() {
        this.clearScene();
        if (this.scene) {
            this.scene.dispose();
        }
        if (this.engine) {
            this.engine.dispose();
        }
    }
}

