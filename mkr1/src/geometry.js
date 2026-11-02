export const createQuad = (p1, p2, p3, p4) => [
    ...p1, ...p2, ...p3,
    ...p1, ...p3, ...p4,
];

export const createRect = (x, y, width, height) => createQuad(
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
);

export const createGradientColors = (positions, topColor, bottomColor, accentColor) => {
    const colors = [];
    const minY = -0.30;
    const maxY = 0.30;

    for (let i = 0; i < positions.length; i += 2) {
        const x = positions[i];
        const y = positions[i + 1];

        const tY = Math.min(1, Math.max(0, (y - minY) / (maxY - minY)));
        const tX = Math.min(1, Math.max(0, (x + 0.20) / 0.40));

        const r = bottomColor[0] * (1 - tY) + topColor[0] * tY + accentColor[0] * tX * 0.25;
        const g = bottomColor[1] * (1 - tY) + topColor[1] * tY + accentColor[1] * tX * 0.25;
        const b = bottomColor[2] * (1 - tY) + topColor[2] * tY + accentColor[2] * tX * 0.25;

        colors.push(
            Math.min(1, r),
            Math.min(1, g),
            Math.min(1, b),
            1.0,
        );
    }

    return colors;
};

export const createLetterK = () => {
    const positions = [
        ...createRect(-0.18, -0.30, 0.08, 0.60),
        ...createRect(-0.10, -0.04, 0.05, 0.08),
        ...createQuad([-0.06, -0.04], [0.18, 0.30], [0.09, 0.30], [-0.06, 0.05]),
        ...createQuad([-0.06, -0.05], [0.09, -0.30], [0.18, -0.30], [-0.06, 0.04]),
    ];

    const colors = createGradientColors(
        positions,
        [0.15, 0.90, 1.00],
        [0.20, 0.35, 0.95],
        [0.60, 0.20, 1.00],
    );

    return { positions, colors, vertexCount: positions.length / 2 };
};

export const createLetterD = () => {
    const positions = [
        ...createRect(-0.09, 0.22, 0.23, 0.08),
        ...createQuad([-0.15, -0.10], [-0.06, -0.10], [-0.01, 0.22], [-0.09, 0.22]),
        ...createRect(0.06, -0.10, 0.08, 0.32),
        ...createRect(-0.20, -0.18, 0.40, 0.08),
        ...createRect(-0.20, -0.30, 0.08, 0.12),
        ...createRect(0.12, -0.30, 0.08, 0.12),
    ];

    const colors = createGradientColors(
        positions,
        [1.00, 0.78, 0.15],
        [0.95, 0.20, 0.55],
        [1.00, 0.45, 0.10],
    );

    return { positions, colors, vertexCount: positions.length / 2 };
};

export const createLetterO = () => {
    const positions = [
        ...createRect(-0.18, -0.22, 0.08, 0.44),
        ...createRect(0.10, -0.22, 0.08, 0.44),
        ...createRect(-0.18, 0.22, 0.36, 0.08),
        ...createRect(-0.18, -0.30, 0.36, 0.08),
    ];

    const colors = createGradientColors(
        positions,
        [0.20, 0.95, 0.55],
        [0.05, 0.65, 0.85],
        [0.80, 1.00, 0.25],
    );

    return { positions, colors, vertexCount: positions.length / 2 };
};
