/**
 * Procedural 3D mesh generators with smooth analytical vertex normals
 * for Phong lighting and shading.
 */

export const createTorus = (
    majorRadius = 0.88,
    minorRadius = 0.34,
    radialSegments = 56,
    tubularSegments = 36,
) => {
    const positions = [];
    const normals = [];
    const indices = [];

    for (let i = 0; i <= radialSegments; i++) {
        const u = (i / radialSegments) * Math.PI * 2;
        const cosU = Math.cos(u);
        const sinU = Math.sin(u);

        for (let j = 0; j <= tubularSegments; j++) {
            const v = (j / tubularSegments) * Math.PI * 2;
            const cosV = Math.cos(v);
            const sinV = Math.sin(v);

            const ringRadius = majorRadius + minorRadius * cosV;
            positions.push(
                ringRadius * cosU,
                ringRadius * sinU,
                minorRadius * sinV,
            );

            normals.push(
                cosV * cosU,
                cosV * sinU,
                sinV,
            );
        }
    }

    const stride = tubularSegments + 1;
    for (let i = 0; i < radialSegments; i++) {
        for (let j = 0; j < tubularSegments; j++) {
            const a = i * stride + j;
            const b = (i + 1) * stride + j;
            const c = (i + 1) * stride + (j + 1);
            const d = i * stride + (j + 1);

            indices.push(a, b, d, b, c, d);
        }
    }

    return {
        positions,
        normals,
        indices,
        vertexCount: indices.length,
    };
};

export const createSphere = (radius = 1.05, latBands = 40, lonBands = 56) => {
    const positions = [];
    const normals = [];
    const indices = [];

    for (let lat = 0; lat <= latBands; lat++) {
        const theta = (lat / latBands) * Math.PI;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= lonBands; lon++) {
            const phi = (lon / lonBands) * Math.PI * 2;
            const nx = Math.cos(phi) * sinTheta;
            const ny = cosTheta;
            const nz = Math.sin(phi) * sinTheta;

            normals.push(nx, ny, nz);
            positions.push(radius * nx, radius * ny, radius * nz);
        }
    }

    const stride = lonBands + 1;
    for (let lat = 0; lat < latBands; lat++) {
        for (let lon = 0; lon < lonBands; lon++) {
            const a = lat * stride + lon;
            const b = (lat + 1) * stride + lon;
            const c = (lat + 1) * stride + (lon + 1);
            const d = lat * stride + (lon + 1);

            indices.push(a, d, b, b, d, c);
        }
    }

    return {
        positions,
        normals,
        indices,
        vertexCount: indices.length,
    };
};
