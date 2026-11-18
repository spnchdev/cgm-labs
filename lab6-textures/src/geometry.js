// ============================================================================
// Vector Math Helpers for Procedural Geometry & Normal Generation
// ============================================================================

const normalizeVec3 = (x, y, z) => {
    const len = Math.hypot(x, y, z) || 1;
    return [x / len, y / len, z / len];
};

const crossVec3 = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];

// Converts HSL hue in [0, 1] into vibrant RGB vertex colors
const hslToRgb = (h, s = 0.78, l = 0.56) => {
    const k = (n) => (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const channel = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [channel(0), channel(8), channel(4)];
};

// ============================================================================
// Arbitrary Shape 1: Parametric 3D Trefoil Knot with Frenet Frame Normals
// ============================================================================

export const createTrefoilKnot = (
    scale = 0.34,
    tubeRadius = 0.24,
    pathSegments = 128,
    radialSegments = 28,
) => {
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];

    const evaluateCurve = (t) => [
        scale * (Math.sin(t) + 2 * Math.sin(2 * t)),
        scale * (Math.cos(t) - 2 * Math.cos(2 * t)),
        scale * (-Math.sin(3 * t)),
    ];

    const evaluateTangent = (t) => normalizeVec3(
        Math.cos(t) + 4 * Math.cos(2 * t),
        -Math.sin(t) + 4 * Math.sin(2 * t),
        -3 * Math.cos(3 * t),
    );

    const evaluateSecondDeriv = (t) => [
        -Math.sin(t) - 8 * Math.sin(2 * t),
        -Math.cos(t) + 8 * Math.cos(2 * t),
        9 * Math.sin(3 * t),
    ];

    // Generate tube rings along the closed parametric curve
    for (let i = 0; i <= pathSegments; i++) {
        const u = i / pathSegments;
        const t = u * Math.PI * 2;

        const center = evaluateCurve(t);
        const tangent = evaluateTangent(t);
        const d2 = evaluateSecondDeriv(t);
        const binormalRaw = crossVec3(tangent, d2);
        const binormal = normalizeVec3(...binormalRaw);
        const normal = normalizeVec3(...crossVec3(binormal, tangent));
        const rgb = hslToRgb(u % 1.0, 0.76, 0.55);

        for (let j = 0; j <= radialSegments; j++) {
            const v = (j / radialSegments) * Math.PI * 2;
            const cosV = Math.cos(v);
            const sinV = Math.sin(v);

            const nx = normal[0] * cosV + binormal[0] * sinV;
            const ny = normal[1] * cosV + binormal[1] * sinV;
            const nz = normal[2] * cosV + binormal[2] * sinV;

            positions.push(
                center[0] + tubeRadius * nx,
                center[1] + tubeRadius * ny,
                center[2] + tubeRadius * nz,
            );
            normals.push(nx, ny, nz);
            colors.push(...rgb);
        }
    }

    // Triangulate adjacent tube rings into indexed triangles
    const stride = radialSegments + 1;
    for (let i = 0; i < pathSegments; i++) {
        for (let j = 0; j < radialSegments; j++) {
            const a = i * stride + j;
            const b = (i + 1) * stride + j;
            const c = (i + 1) * stride + (j + 1);
            const d = i * stride + (j + 1);

            indices.push(a, d, b, b, d, c);
        }
    }

    return {
        positions,
        normals,
        colors,
        indices,
        vertexCount: indices.length,
    };
};

// ============================================================================
// Arbitrary Shape 2: Surface of Revolution (3D Vase / Goblet)
// ============================================================================

export const createLatheVase = (heightSegments = 64, radialSegments = 56) => {
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];

    // Smooth profile radius r(u) for normalized height u in [0, 1]
    const profileRadius = (u) => {
        const base = 0.42 + 0.34 * Math.sin(u * Math.PI * 1.15);
        const waist = -0.18 * Math.sin(u * Math.PI * 2.4);
        const rim = 0.14 * Math.pow(u, 4);
        return Math.max(0.16, base + waist + rim);
    };

    const height = 2.0;
    const eps = 0.002;

    for (let i = 0; i <= heightSegments; i++) {
        const u = i / heightSegments;
        const y = (u - 0.5) * height;
        const r = profileRadius(u);

        // Numerical derivative dr/dy to compute exact outward surface normal
        const uPrev = Math.max(0, u - eps);
        const uNext = Math.min(1, u + eps);
        const drDy = (profileRadius(uNext) - profileRadius(uPrev)) / ((uNext - uPrev) * height);
        const [nr, ny] = normalizeVec3(1.0, -drDy, 0.0);

        const rgb = hslToRgb(0.54 + u * 0.35, 0.74, 0.54);

        for (let j = 0; j <= radialSegments; j++) {
            const phi = (j / radialSegments) * Math.PI * 2;
            const cosPhi = Math.cos(phi);
            const sinPhi = Math.sin(phi);

            positions.push(r * cosPhi, y, r * sinPhi);
            normals.push(nr * cosPhi, ny, nr * sinPhi);
            colors.push(...rgb);
        }
    }

    const stride = radialSegments + 1;
    for (let i = 0; i < heightSegments; i++) {
        for (let j = 0; j < radialSegments; j++) {
            const a = i * stride + j;
            const b = (i + 1) * stride + j;
            const c = (i + 1) * stride + (j + 1);
            const d = i * stride + (j + 1);

            indices.push(a, d, b, b, d, c);
        }
    }

    return {
        positions,
        normals,
        colors,
        indices,
        vertexCount: indices.length,
    };
};
