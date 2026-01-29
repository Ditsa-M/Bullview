/**
 * File parsers for DNA topology and configuration files
 */

/**
 * Parse topology file (.psp format)
 */
export class TopologyParser {
    parse(content) {
        const lines = content.split('\n').map(line => line.trim());
        const topology = {
            header: null,
            patches: [],
            springs: [],
            particles: []
        };

        let currentLine = 0;

        // Parse header (first non-comment line)
        while (currentLine < lines.length) {
            const line = lines[currentLine];
            if (line && !line.startsWith('#')) {
                const parts = line.split(/\s+/).map(Number);
                topology.header = {
                    numParticles: parts[0],
                    numStrands: parts[1],
                    maxSpringsPerParticle: parts[2],
                    repeatedPatchesPerParticle: parts[3]
                };
                currentLine++;
                break;
            }
            currentLine++;
        }

        if (!topology.header) {
            throw new Error('Invalid topology file: no header found');
        }

        // Parse patches and springs
        while (currentLine < lines.length) {
            const line = lines[currentLine];

            if (line && !line.startsWith('#')) {
                const parts = line.split(/\s+/);

                if (parts[0] === 'iP') {
                    // Patch definition: iP patchId color strength x y z
                    topology.patches.push({
                        id: parseInt(parts[1]),
                        color: parseInt(parts[2]),
                        strength: parseFloat(parts[3]),
                        position: {
                            x: parseFloat(parts[4]),
                            y: parseFloat(parts[5]),
                            z: parseFloat(parts[6])
                        }
                    });
                } else if (parts[0] === 'iS') {
                    // Spring definition: iS springId k r0 x y z
                    topology.springs.push({
                        id: parseInt(parts[1]),
                        stiffness: parseFloat(parts[2]),
                        restLength: parseFloat(parts[3]),
                        position: {
                            x: parseFloat(parts[4]),
                            y: parseFloat(parts[5]),
                            z: parseFloat(parts[6])
                        }
                    });
                } else {
                    // Particle definition: particleType strand radius mass numPatches patchId ... springConnections
                    const particleType = parseInt(parts[0]);
                    const strand = parseInt(parts[1]);
                    const radius = parseFloat(parts[2]);
                    const mass = parseFloat(parts[3]);
                    const numPatches = parseInt(parts[4]);

                    const particlePatches = [];
                    const particleConnections = [];

                    let idx = 5;
                    // Read patch IDs
                    for (let i = 0; i < numPatches; i++) {
                        particlePatches.push(parseInt(parts[idx++]));
                    }

                    // Read spring connections (pairs of particleIndex, springIndex)
                    while (idx < parts.length) {
                        if (idx + 1 < parts.length) {
                            particleConnections.push({
                                particleIndex: parseInt(parts[idx]),
                                springIndex: parseInt(parts[idx + 1])
                            });
                            idx += 2;
                        } else {
                            break;
                        }
                    }

                    topology.particles.push({
                        index: topology.particles.length,
                        type: particleType,
                        strand: strand,
                        radius: radius,
                        mass: mass,
                        patches: particlePatches,
                        connections: particleConnections
                    });
                }
            }

            currentLine++;
        }

        return topology;
    }
}

/**
 * Parse configuration file (.dat format)
 */
export class ConfigurationParser {
    parse(content) {
        const lines = content.split('\n').map(line => line.trim());
        const config = {
            timestep: 0,
            box: { x: 0, y: 0, z: 0 },
            energy: { total: 0, potential: 0, kinetic: 0 },
            nucleotides: []
        };

        let currentLine = 0;

        // Parse header (3 lines)
        if (lines[currentLine].startsWith('t =')) {
            config.timestep = parseInt(lines[currentLine].split('=')[1].trim());
            currentLine++;
        }

        if (lines[currentLine].startsWith('b =')) {
            const boxParts = lines[currentLine].split('=')[1].trim().split(/\s+/).map(parseFloat);
            config.box = { x: boxParts[0], y: boxParts[1], z: boxParts[2] };
            currentLine++;
        }

        if (lines[currentLine].startsWith('E =')) {
            const energyParts = lines[currentLine].split('=')[1].trim().split(/\s+/).map(parseFloat);
            config.energy = { total: energyParts[0], potential: energyParts[1], kinetic: energyParts[2] };
            currentLine++;
        }

        // Parse nucleotide data
        while (currentLine < lines.length) {
            const line = lines[currentLine];
            if (line && !line.startsWith('#')) {
                const parts = line.split(/\s+/).map(parseFloat);

                if (parts.length >= 15) {
                    config.nucleotides.push({
                        index: config.nucleotides.length,
                        position: { x: parts[0], y: parts[1], z: parts[2] },
                        baseVector: { x: parts[3], y: parts[4], z: parts[5] },
                        normalVector: { x: parts[6], y: parts[7], z: parts[8] },
                        velocity: { x: parts[9], y: parts[10], z: parts[11] },
                        angularVelocity: { x: parts[12], y: parts[13], z: parts[14] }
                    });
                }
            }
            currentLine++;
        }

        return config;
    }
}

/**
 * Combine topology and configuration data
 */
export class DataCombiner {
    /**
     * Combine topology and configuration to create complete particle data
     */
    static combine(topology, configuration) {
        if (topology.header.numParticles !== configuration.nucleotides.length) {
            console.warn(`Particle count mismatch: topology=${topology.header.numParticles}, config=${configuration.nucleotides.length}`);
        }

        const particles = [];
        const count = Math.min(topology.particles.length, configuration.nucleotides.length);

        for (let i = 0; i < count; i++) {
            const topoParticle = topology.particles[i];
            const configNucleotide = configuration.nucleotides[i];

            // Get patch info
            const patchesData = topoParticle.patches.map(patchId => {
                const patch = topology.patches.find(p => p.id === patchId);
                return patch || null;
            }).filter(p => p !== null);

            particles.push({
                index: i,

                // From topology
                type: topoParticle.type,
                strand: topoParticle.strand,
                radius: topoParticle.radius,
                mass: topoParticle.mass,
                patches: patchesData,
                connections: topoParticle.connections,

                // From configuration
                position: new BABYLON.Vector3(
                    configNucleotide.position.x,
                    configNucleotide.position.y,
                    configNucleotide.position.z
                ),
                baseVector: new BABYLON.Vector3(
                    configNucleotide.baseVector.x,
                    configNucleotide.baseVector.y,
                    configNucleotide.baseVector.z
                ),
                normalVector: new BABYLON.Vector3(
                    configNucleotide.normalVector.x,
                    configNucleotide.normalVector.y,
                    configNucleotide.normalVector.z
                ),
                velocity: new BABYLON.Vector3(
                    configNucleotide.velocity.x,
                    configNucleotide.velocity.y,
                    configNucleotide.velocity.z
                ),
                angularVelocity: new BABYLON.Vector3(
                    configNucleotide.angularVelocity.x,
                    configNucleotide.angularVelocity.y,
                    configNucleotide.angularVelocity.z
                )
            });
        }

        // Create spring/bond data
        const bonds = [];
        for (const particle of particles) {
            for (const connection of particle.connections) {
                // Avoid duplicate bonds
                const existingBond = bonds.find(b =>
                    (b.from === particle.index && b.to === connection.particleIndex) ||
                    (b.from === connection.particleIndex && b.to === particle.index)
                );

                if (!existingBond && connection.particleIndex < particles.length) {
                    const spring = topology.springs.find(s => s.id === connection.springIndex);
                    bonds.push({
                        from: particle.index,
                        to: connection.particleIndex,
                        spring: spring || null
                    });
                }
            }
        }

        return {
            particles,
            bonds,
            metadata: {
                timestep: configuration.timestep,
                box: configuration.box,
                energy: configuration.energy,
                numStrands: topology.header.numStrands
            }
        };
    }
}
