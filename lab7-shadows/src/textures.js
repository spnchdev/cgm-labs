/**
 * Generates power-of-two (256x256) procedural textures as HTMLImageElements
 * so WebGL texture loading works reliably offline without CORS issues.
 */

const TEXTURE_SIZE = 256;

const createOffscreenCanvas = (size = TEXTURE_SIZE) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
};

const drawWoodGrain = (ctx, x, y, w, h, seed) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.strokeStyle = 'rgba(62, 34, 14, 0.22)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
        const offset = ((i * 19 + seed * 37) % h);
        ctx.beginPath();
        ctx.moveTo(x, y + offset);
        ctx.bezierCurveTo(
            x + w * 0.33, y + offset + Math.sin(i + seed) * 6,
            x + w * 0.66, y + offset - Math.cos(i + seed) * 6,
            x + w, y + offset,
        );
        ctx.stroke();
    }
    ctx.restore();
};

export const createWoodenCrateCanvas = () => {
    const canvas = createOffscreenCanvas();
    const ctx = canvas.getContext('2d');
    const S = TEXTURE_SIZE;
    const border = 26;

    // Base warm wood planks
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(0, 0, S, S);

    const plankCount = 4;
    const plankHeight = (S - border * 2) / plankCount;
    for (let i = 0; i < plankCount; i++) {
        const py = border + i * plankHeight;
        ctx.fillStyle = i % 2 === 0 ? '#9c6633' : '#855326';
        ctx.fillRect(border, py, S - border * 2, plankHeight);
        drawWoodGrain(ctx, border, py, S - border * 2, plankHeight, i + 1);

        ctx.strokeStyle = '#3d220c';
        ctx.lineWidth = 2;
        ctx.strokeRect(border, py, S - border * 2, plankHeight);
    }

    // Diagonal brace across inner crate
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#73451d';
    ctx.fillRect(-S * 0.52, -13, S * 1.04, 26);
    ctx.strokeStyle = '#3d220c';
    ctx.lineWidth = 2;
    ctx.strokeRect(-S * 0.52, -13, S * 1.04, 26);
    ctx.restore();

    // Outer wooden frame
    ctx.fillStyle = '#a46e39';
    ctx.fillRect(0, 0, S, border);
    ctx.fillRect(0, S - border, S, border);
    ctx.fillRect(0, 0, border, S);
    ctx.fillRect(S - border, 0, border, S);

    ctx.strokeStyle = '#361d09';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
    ctx.strokeRect(border, border, S - border * 2, S - border * 2);

    // Corner metal bolts
    const boltCoords = [
        [13, 13], [S - 13, 13], [13, S - 13], [S - 13, S - 13],
    ];
    for (const [bx, by] of boltCoords) {
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // Upward directional arrow (like Lab 7 reference diagram)
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(S / 2, 58);
    ctx.lineTo(S / 2 + 34, 104);
    ctx.lineTo(S / 2 + 14, 104);
    ctx.lineTo(S / 2 + 14, 188);
    ctx.lineTo(S / 2 - 14, 188);
    ctx.lineTo(S / 2 - 14, 104);
    ctx.lineTo(S / 2 - 34, 104);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    return canvas;
};

export const createBrickWallCanvas = () => {
    const canvas = createOffscreenCanvas();
    const ctx = canvas.getContext('2d');
    const S = TEXTURE_SIZE;

    // Mortar background
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, S, S);

    const rows = 8;
    const cols = 4;
    const mortar = 5;
    const rowH = S / rows;
    const brickW = S / cols;
    const palette = ['#b93829', '#a63124', '#c2412f', '#9a2c20', '#ba4832'];

    for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (brickW / 2);
        for (let c = -1; c <= cols; c++) {
            const x = c * brickW + offset + mortar / 2;
            const y = r * rowH + mortar / 2;
            const w = brickW - mortar;
            const h = rowH - mortar;

            const colorIdx = Math.abs((r * 7 + c * 13) % palette.length);
            ctx.fillStyle = palette[colorIdx];
            ctx.fillRect(x, y, w, h);

            // Subtle top highlight & bottom shadow for depth
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.fillRect(x, y, w, 3);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
            ctx.fillRect(x, y + h - 3, w, 3);
        }
    }

    return canvas;
};

export const canvasToImage = (canvas) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL('image/png');
});

export const fileToImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
});
