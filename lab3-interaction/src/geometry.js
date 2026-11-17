/**
 * Generates vertex positions, per-face distinct colors, and triangle indices
 * for a 3D cube centered at the origin.
 */
export const createCube = (size = 1.4) => {
    const h = size / 2;

    const faces = [
        {
            // Front (+Z) — Cyan
            corners: [
                [-h, -h,  h],
                [ h, -h,  h],
                [ h,  h,  h],
                [-h,  h,  h],
            ],
            color: [0.06, 0.78, 0.94],
        },
        {
            // Back (-Z) — Magenta
            corners: [
                [ h, -h, -h],
                [-h, -h, -h],
                [-h,  h, -h],
                [ h,  h, -h],
            ],
            color: [0.85, 0.27, 0.94],
        },
        {
            // Top (+Y) — Yellow
            corners: [
                [-h,  h,  h],
                [ h,  h,  h],
                [ h,  h, -h],
                [-h,  h, -h],
            ],
            color: [0.98, 0.80, 0.14],
        },
        {
            // Bottom (-Y) — Orange
            corners: [
                [-h, -h, -h],
                [ h, -h, -h],
                [ h, -h,  h],
                [-h, -h,  h],
            ],
            color: [0.98, 0.45, 0.09],
        },
        {
            // Right (+X) — Emerald
            corners: [
                [ h, -h,  h],
                [ h, -h, -h],
                [ h,  h, -h],
                [ h,  h,  h],
            ],
            color: [0.13, 0.77, 0.37],
        },
        {
            // Left (-X) — Royal Blue
            corners: [
                [-h, -h, -h],
                [-h, -h,  h],
                [-h,  h,  h],
                [-h,  h, -h],
            ],
            color: [0.23, 0.51, 0.96],
        },
    ];

    const cornerShades = [0.86, 0.95, 1.0, 0.92];
    const positions = [];
    const colors = [];
    const indices = [];

    for (const [faceIndex, face] of faces.entries()) {
        const baseVertex = faceIndex * 4;
        const [r, g, b] = face.color;

        for (const [cornerIndex, corner] of face.corners.entries()) {
            const shade = cornerShades[cornerIndex];
            positions.push(...corner);
            colors.push(r * shade, g * shade, b * shade, 1.0);
        }

        indices.push(
            baseVertex, baseVertex + 1, baseVertex + 2,
            baseVertex, baseVertex + 2, baseVertex + 3,
        );
    }

    return {
        positions,
        colors,
        indices,
        vertexCount: indices.length,
    };
};
