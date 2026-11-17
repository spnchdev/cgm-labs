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
