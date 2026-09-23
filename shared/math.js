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
