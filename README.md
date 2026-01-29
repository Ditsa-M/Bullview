# Bullview

## Topology Description

```
4 2 1 1
# Header = Number of particles, strands, max number of springs per particle, repeated patches per particle

# iP = iP, color, strength,pos x y z  ### Patch info

iP 0 -21 100 0 5 0
iP 1 21 100 0 -5 0

# iS = iS, k, r0, pos x, y , z  #### Spring info

iS 0 100 1 5 0 0
iS 1 100 1 -5 0 0

# Body = particleType, strand,radius,mass,NumPatches iP ...... ,iS ([particle index, spring index] ...)
# Color 100 is blank color, Neighbour -1 is blank

-5 0 5 1 1 0 1 0
-5 0 5 1 1 0 0 1 2 0
-5 0 5 1 1 0 1 1
-5 1 5 1 1 1
```

## Configuration Description

## Configuration file

```{warning}
Nucleotides are listed in the 3' {math}`\to` 5' order if using the "classic" topology format or in the 5' {math}`\to` 3' order if using the "new" format (see [Topology file](#topology-file)).
```

The first three rows of a configuration file contain the timestep T at which the configuration has been printed, the length of the box sides Lx, Ly and Lz and the total, potential and kinetic energies, Etot, U and K, respectively:

```text
t = T
b = Lz Ly Lz
E = Etot U K
```

After this header, each row contains position of the centre of mass, orientation, velocity and angular velocity of a single nucleotide in the following order: 

$$
\overbrace{r_x r_y r_z}^{\rm centre-of-mass\,\, position\,\, r} \underbrace{b_x b_y b_z}_{{\rm base\,\, vector\,\,} \vec{a}_1} \overbrace{n_x n_y n_z}^{{\rm base\,\, normal\,\, vector\,\,} \vec{a}_3} \underbrace{v_x v_y v_z}_{\rm Velocity} \overbrace{L_x L_y L_z}^{\rm Angular\,\, velocity}
$$

$\vec{a}_1$, $\vec{a}_2 = \vec{a}_3 \times \vec{a}_1$ and $\vec{a}_3$ define the local reference frame through which the position of all interaction sites relative to the centre of mass are calculated.