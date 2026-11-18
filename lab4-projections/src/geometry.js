/**
 * Shared 3D box coordinates (used identically by both crate and lid)
 * and distinct arbitrary color palettes for each object.
 */
export const createBoxGeometry = (size = 1.0) => {
    const h = size / 2;

    const faces = [
        // Front (+Z)
        [[-h, -h,  h], [ h, -h,  h], [ h,  h,  h], [-h,  h,  h]],
        // Back (-Z)
        [[ h, -h, -h], [-h, -h, -h], [-h,  h, -h], [ h,  h, -h]],
        // Top (+Y)
        [[-h,  h,  h], [ h,  h,  h], [ h,  h, -h], [-h,  h, -h]],
        // Bottom (-Y)
        [[-h, -h, -h], [ h, -h, -h], [ h, -h,  h], [-h, -h,  h]],
        // Right (+X)
        [[ h, -h,  h], [ h, -h, -h], [ h,  h, -h], [ h,  h,  h]],
        // Left (-X)
        [[-h, -h, -h], [-h, -h,  h], [-h,  h,  h], [-h,  h, -h]],
    ];

    const positions = [];
    const indices = [];

    for (const [faceIndex, corners] of faces.entries()) {
        const base = faceIndex * 4;
        for (const corner of corners) {
            positions.push(...corner);
        }
        indices.push(
            base, base + 1, base + 2,
            base, base + 2, base + 3,
        );
    }

    return {
        positions,
        indices,
        vertexCount: indices.length,
    };
};

const buildFaceColors = (facePalette) => {
    const cornerShades = [0.88, 0.96, 1.0, 0.92];
    const colors = [];

    for (const [r, g, b] of facePalette) {
        for (const shade of cornerShades) {
            colors.push(r * shade, g * shade, b * shade);
        }
    }

    return colors;
};

export const createCrateColors = () => buildFaceColors([
    [0.94, 0.24, 0.24], // Front: crimson red
    [0.96, 0.78, 0.14], // Back: amber yellow
    [0.10, 0.14, 0.22], // Top (crate interior surface): deep slate
    [0.18, 0.80, 0.44], // Bottom: emerald green
    [0.08, 0.76, 0.90], // Right: cyan
    [0.24, 0.48, 0.96], // Left: royal blue
]);

export const createLidColors = () => buildFaceColors([
    [0.98, 0.52, 0.12], // Front edge: bright orange
    [0.72, 0.30, 0.94], // Back edge: violet
    [0.64, 0.72, 0.16], // Top surface: olive gold
    [0.22, 0.44, 0.94], // Underside: cobalt blue
    [0.95, 0.36, 0.62], // Right edge: rose
    [0.14, 0.76, 0.74], // Left edge: teal
]);
