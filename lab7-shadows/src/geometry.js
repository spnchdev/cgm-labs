/**
 * Generates textured 2D quad and 3D cube geometries with UV coordinates (s, t) in [0, 1].
 */

export const createTexturedQuad = (halfSize = 0.72) => {
    const h = halfSize;
    const positions = [
        -h, -h, 0.0,
         h, -h, 0.0,
         h,  h, 0.0,
        -h,  h, 0.0,
    ];

    const texCoords = [
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
    ];

    const indices = [0, 1, 2, 0, 2, 3];

    return {
        positions,
        texCoords,
        indices,
        vertexCount: indices.length,
    };
};

export const createTexturedCube = (size = 1.35) => {
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

    const faceUvs = [
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
    ];

    const positions = [];
    const texCoords = [];
    const indices = [];

    for (const [faceIndex, corners] of faces.entries()) {
        const base = faceIndex * 4;
        for (const corner of corners) {
            positions.push(...corner);
        }
        texCoords.push(...faceUvs);
        indices.push(
            base, base + 1, base + 2,
            base, base + 2, base + 3,
        );
    }

    return {
        positions,
        texCoords,
        indices,
        vertexCount: indices.length,
    };
};
