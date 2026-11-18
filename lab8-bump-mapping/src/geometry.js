/**
 * Generates unit box geometry (positions, outward normals, triangle indices)
 * used to instantiate the ground plane, two smaller boxes, and light marker.
 */
export const createBoxGeometry = (size = 1.0) => {
    const h = size / 2;

    const faces = [
        // Front (+Z)
        { corners: [[-h, -h,  h], [ h, -h,  h], [ h,  h,  h], [-h,  h,  h]], normal: [ 0,  0,  1] },
        // Back (-Z)
        { corners: [[ h, -h, -h], [-h, -h, -h], [-h,  h, -h], [ h,  h, -h]], normal: [ 0,  0, -1] },
        // Top (+Y)
        { corners: [[-h,  h,  h], [ h,  h,  h], [ h,  h, -h], [-h,  h, -h]], normal: [ 0,  1,  0] },
        // Bottom (-Y)
        { corners: [[-h, -h, -h], [ h, -h, -h], [ h, -h,  h], [-h, -h,  h]], normal: [ 0, -1,  0] },
        // Right (+X)
        { corners: [[ h, -h,  h], [ h, -h, -h], [ h,  h, -h], [ h,  h,  h]], normal: [ 1,  0,  0] },
        // Left (-X)
        { corners: [[-h, -h, -h], [-h, -h,  h], [-h,  h,  h], [-h,  h, -h]], normal: [-1,  0,  0] },
    ];

    const positions = [];
    const normals = [];
    const indices = [];

    for (const [faceIndex, face] of faces.entries()) {
        const base = faceIndex * 4;
        for (const corner of face.corners) {
            positions.push(...corner);
            normals.push(...face.normal);
        }
        indices.push(
            base, base + 1, base + 2,
            base, base + 2, base + 3,
        );
    }

    return {
        positions,
        normals,
        indices,
        vertexCount: indices.length,
    };
};
