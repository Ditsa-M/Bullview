/**
 * Interaction manager for DNA visualization
 */

export class InteractionManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.selectedParticles = new Set();
        this.hoveredParticle = null;
        this.multiSelectEnabled = false;

        this.onSelectionChanged = null;
        this.onHoverChanged = null;

        this.setupEventListeners();
    }

    /**
     * Setup mouse and keyboard event listeners
     */
    setupEventListeners() {
        const canvas = this.renderer.canvas;

        // Click event for selection
        canvas.addEventListener('click', (event) => {
            this.handleClick(event);
        });

        // Mouse move for hover
        canvas.addEventListener('mousemove', (event) => {
            this.handleMouseMove(event);
        });

        // Keyboard for multi-select
        window.addEventListener('keydown', (event) => {
            if (event.ctrlKey || event.metaKey) {
                this.multiSelectEnabled = true;
            }
        });

        window.addEventListener('keyup', (event) => {
            if (!event.ctrlKey && !event.metaKey) {
                this.multiSelectEnabled = false;
            }
        });

        // Escape to clear selection
        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.clearSelection();
            }
        });
    }

    /**
     * Handle click event
     */
    handleClick(event) {
        const rect = this.renderer.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const particle = this.renderer.pickParticle(x, y);

        if (particle) {
            if (this.multiSelectEnabled) {
                // Toggle selection
                if (this.selectedParticles.has(particle.index)) {
                    this.deselectParticle(particle.index);
                } else {
                    this.selectParticle(particle.index);
                }
            } else {
                // Single selection
                this.clearSelection();
                this.selectParticle(particle.index);
            }
        } else {
            if (!this.multiSelectEnabled) {
                this.clearSelection();
            }
        }
    }

    /**
     * Handle mouse move event
     */
    handleMouseMove(event) {
        const rect = this.renderer.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const particle = this.renderer.pickParticle(x, y);

        if (particle && particle.index !== this.hoveredParticle) {
            this.hoveredParticle = particle.index;

            if (this.onHoverChanged) {
                this.onHoverChanged(particle);
            }
        } else if (!particle && this.hoveredParticle !== null) {
            this.hoveredParticle = null;

            if (this.onHoverChanged) {
                this.onHoverChanged(null);
            }
        }
    }

    /**
     * Select a particle
     */
    selectParticle(particleIndex) {
        this.selectedParticles.add(particleIndex);
        this.renderer.highlightNucleotide(particleIndex, true);

        if (this.onSelectionChanged) {
            this.onSelectionChanged(Array.from(this.selectedParticles));
        }
    }

    /**
     * Deselect a particle
     */
    deselectParticle(particleIndex) {
        this.selectedParticles.delete(particleIndex);
        this.renderer.highlightNucleotide(particleIndex, false);

        if (this.onSelectionChanged) {
            this.onSelectionChanged(Array.from(this.selectedParticles));
        }
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        this.selectedParticles.forEach(index => {
            this.renderer.highlightNucleotide(index, false);
        });
        this.selectedParticles.clear();

        if (this.onSelectionChanged) {
            this.onSelectionChanged([]);
        }
    }

    /**
     * Get selected particles
     */
    getSelectedParticles() {
        return Array.from(this.selectedParticles);
    }

    /**
     * Select particles by strand
     */
    selectByStrand(strandId) {
        if (!this.renderer.data) return;

        this.clearSelection();

        this.renderer.data.particles.forEach(particle => {
            if (particle.strand === strandId) {
                this.selectParticle(particle.index);
            }
        });
    }

    /**
     * Select particles within a radius
     */
    selectWithinRadius(centerParticle, radius) {
        if (!this.renderer.data) return;

        const centerPos = centerParticle.position;

        this.renderer.data.particles.forEach(particle => {
            const distance = BABYLON.Vector3.Distance(centerPos, particle.position);
            if (distance <= radius) {
                this.selectParticle(particle.index);
            }
        });
    }
}
