export const createIdentityMatrix = () => new Float32Array([
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0,
]);

export const createXRotationMatrix = (angleInRadians) => {
    const s = Math.sin(angleInRadians);
    const c = Math.cos(angleInRadians);

    return new Float32Array([
        1.0, 0.0, 0.0, 0.0,
        0.0,   c,   s, 0.0,
        0.0,  -s,   c, 0.0,
        0.0, 0.0, 0.0, 1.0,
    ]);
};

export const createYRotationMatrix = (angleInRadians) => {
    const s = Math.sin(angleInRadians);
    const c = Math.cos(angleInRadians);

    return new Float32Array([
          c, 0.0,  -s, 0.0,
        0.0, 1.0, 0.0, 0.0,
          s, 0.0,   c, 0.0,
        0.0, 0.0, 0.0, 1.0,
    ]);
};

export const createZRotationMatrix = (angleInRadians) => {
    const s = Math.sin(angleInRadians);
    const c = Math.cos(angleInRadians);
    
    return new Float32Array([
           c,   s, 0.0, 0.0,
          -s,   c, 0.0, 0.0,
         0.0, 0.0, 1.0, 0.0,
         0.0, 0.0, 0.0, 1.0,
    ]);
};

export const createTranslationMatrix = (tx, ty, tz) => {
    return new Float32Array([
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
         tx,  ty,  tz, 1.0,
    ]);
};

export const createScalingMatrix = (sx, sy, sz = 1.0) => {
    return new Float32Array([
         sx, 0.0, 0.0, 0.0,
        0.0,  sy, 0.0, 0.0,
        0.0, 0.0,  sz, 0.0,
        0.0, 0.0, 0.0, 1.0,
    ]);
};

export const multiplyMatrices = (a, b) => {
    const out = new Float32Array(16);

    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            out[col * 4 + row] =
                a[0 * 4 + row] * b[col * 4 + 0] +
                a[1 * 4 + row] * b[col * 4 + 1] +
                a[2 * 4 + row] * b[col * 4 + 2] +
                a[3 * 4 + row] * b[col * 4 + 3];
        }
    }

    return out;
};

export const createOrthographicMatrix = (left, right, bottom, top, near, far) => {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    return new Float32Array([
        -2 * lr,                    0,                     0, 0,
              0,              -2 * bt,                     0, 0,
              0,                    0,                2 * nf, 0,
        (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1,
    ]);
};

export const createPerspectiveMatrix = (fovInRadians, aspect, near, far) => {
    const f = 1.0 / Math.tan(fovInRadians / 2);
    const nf = 1 / (near - far);

    return new Float32Array([
        f / aspect, 0,                     0,  0,
                 0, f,                     0,  0,
                 0, 0,   (near + far) * nf, -1,
                 0, 0, 2 * far * near * nf,  0,
    ]);
};

export const createNormalMatrix = (m) => {
    const a00 = m[0], a10 = m[1], a20 = m[2];
    const a01 = m[4], a11 = m[5], a21 = m[6];
    const a02 = m[8], a12 = m[9], a22 = m[10];

    const c00 = a11 * a22 - a12 * a21;
    const c10 = a02 * a21 - a01 * a22;
    const c20 = a01 * a12 - a02 * a11;

    const c01 = a12 * a20 - a10 * a22;
    const c11 = a00 * a22 - a02 * a20;
    const c21 = a02 * a10 - a00 * a12;

    const c02 = a10 * a21 - a11 * a20;
    const c12 = a01 * a20 - a00 * a21;
    const c22 = a00 * a11 - a01 * a10;

    const det = a00 * c00 + a10 * c10 + a20 * c20;
    if (Math.abs(det) < 1e-12) {
        return createIdentityMatrix();
    }

    const invDet = 1.0 / det;
    return new Float32Array([
        c00 * invDet, c10 * invDet, c20 * invDet, 0.0,
        c01 * invDet, c11 * invDet, c21 * invDet, 0.0,
        c02 * invDet, c12 * invDet, c22 * invDet, 0.0,
                 0.0,          0.0,          0.0, 1.0,
    ]);
};

export const createLookAtMatrix = (eye, target, up = [0, 1, 0]) => {
    let zx = eye[0] - target[0];
    let zy = eye[1] - target[1];
    let zz = eye[2] - target[2];
    const zLen = Math.hypot(zx, zy, zz) || 1;
    zx /= zLen;
    zy /= zLen;
    zz /= zLen;

    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    const xLen = Math.hypot(xx, xy, xz) || 1;
    xx /= xLen;
    xy /= xLen;
    xz /= xLen;

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    return new Float32Array([
        xx, yx, zx, 0.0,
        xy, yy, zy, 0.0,
        xz, yz, zz, 0.0,
        -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
        -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
        -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
        1.0,
    ]);
};
