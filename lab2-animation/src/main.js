import {
    setupWebGL,
    initShaderProgram,
    createAndBindBuffer,
    updateBuffer,
    bindAttribute,
} from '../../shared/gl-utils.js';

const CIRCLE_SEGMENTS = 48;
const POINT_SIZE = 10.0;

const vsSource = `
    attribute vec2 aVertexPosition;
    attribute vec4 aVertexColor;

    varying lowp vec4 vColor;

    void main() {
        gl_Position = vec4(aVertexPosition, 0.0, 1.0);
        gl_PointSize = ${POINT_SIZE.toFixed(1)};
        vColor = aVertexColor;
    }
`;

const fsSource = `
    varying lowp vec4 vColor;

    void main() {
        gl_FragColor = vColor;
    }
`;

/**
 * Converts a #RRGGBB hex color string into normalized RGBA floats.
 */
const hexToRgba = (hex) => {
    const clean = hex.replace('#', '');
    const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
    const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
    const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
    return [r, g, b, 1.0];
};

/**
 * Converts a pointer event into WebGL Normalized Device Coordinates [-1, 1]
 * using the canvas bounding client rectangle to eliminate cursor offset.
 */
const getCanvasNdcCoords = (event) => {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - canvas.clientLeft;
    const y = event.clientY - rect.top - canvas.clientTop;

    return {
        x: (x / canvas.clientWidth) * 2 - 1,
        y: 1 - (y / canvas.clientHeight) * 2,
    };
};

const initApp = () => {
    const gl = setupWebGL('glcanvas');
    if (!gl) return;

    const canvas = document.getElementById('glcanvas');
    const modeButtons = document.querySelectorAll('.mode-btn');
    const drawColorSelect = document.getElementById('drawColorSelect');
    const bgColorSelect = document.getElementById('bgColorSelect');
    const clearBtn = document.getElementById('clearBtn');
    const statusHint = document.getElementById('statusHint');

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    if (!shaderProgram) return;

    const attribLocations = {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
    };

    const positionBuffer = createAndBindBuffer(gl, [], gl.DYNAMIC_DRAW);
    const colorBuffer = createAndBindBuffer(gl, [], gl.DYNAMIC_DRAW);

    const state = {
        mode: 'point',
        vertices: [],
        pointIndices: [],
        triangleIndices: [],
        circleIndices: [],
        pendingCircleCenterIndex: null,
        clearColor: hexToRgba(bgColorSelect.value),
    };

    const addVertex = (x, y, color) => {
        const index = state.vertices.length;
        state.vertices.push({ x, y, color });
        return index;
    };

    const addCircleFromPendingCenter = (centerIndex, edgeX, edgeY, color) => {
        const center = state.vertices[centerIndex];
        const radius = Math.hypot(edgeX - center.x, edgeY - center.y);

        // Remove the center vertex index from pointIndices now that it forms a circle
        const pointPos = state.pointIndices.indexOf(centerIndex);
        if (pointPos !== -1) {
            state.pointIndices.splice(pointPos, 1);
        }

        const fanIndices = [centerIndex];
        for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
            const angle = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
            const px = center.x + radius * Math.cos(angle);
            const py = center.y + radius * Math.sin(angle);
            fanIndices.push(addVertex(px, py, color));
        }

        state.circleIndices.push(fanIndices);
    };

    const updateStatusHint = () => {
        if (state.mode === 'point') {
            statusHint.textContent = 'Points mode: click anywhere on the canvas to place a point.';
            return;
        }

        if (state.mode === 'triangle') {
            const pending = state.triangleIndices.length % 3;
            statusHint.textContent = `Triangle mode: click ${pending + 1}/3 to define triangle vertices.`;
            return;
        }

        statusHint.textContent = state.pendingCircleCenterIndex === null
            ? 'Circle mode: click to set the circle center.'
            : 'Circle mode: click a second point to set the circle radius.';
    };

    const setMode = (nextMode) => {
        if (state.mode === nextMode) return;
        state.mode = nextMode;
        state.pendingCircleCenterIndex = null;

        for (const btn of modeButtons) {
            const isActive = btn.dataset.mode === nextMode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        }

        updateStatusHint();
    };

    const pushBatchVertices = (indices, positions, colors) => {
        for (const index of indices) {
            const { x, y, color } = state.vertices[index];
            positions.push(x, y);
            colors.push(color[0], color[1], color[2], color[3]);
        }
    };

    const render = () => {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(...state.clearColor);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const packedPositions = [];
        const packedColors = [];

        const completeTriangleCount = Math.floor(state.triangleIndices.length / 3) * 3;
        const pendingTriangleIndices = state.triangleIndices.slice(completeTriangleCount);
        const allPointIndices = [...state.pointIndices, ...pendingTriangleIndices];

        const pointsOffset = 0;
        const pointsCount = allPointIndices.length;
        pushBatchVertices(allPointIndices, packedPositions, packedColors);

        const trianglesOffset = packedPositions.length / 2;
        const trianglesCount = completeTriangleCount;
        pushBatchVertices(
            state.triangleIndices.slice(0, completeTriangleCount),
            packedPositions,
            packedColors
        );

        const circleBatches = [];
        for (const fanIndices of state.circleIndices) {
            const offset = packedPositions.length / 2;
            pushBatchVertices(fanIndices, packedPositions, packedColors);
            circleBatches.push({ offset, count: fanIndices.length });
        }

        if (packedPositions.length === 0) return;

        updateBuffer(gl, positionBuffer, packedPositions, gl.DYNAMIC_DRAW);
        updateBuffer(gl, colorBuffer, packedColors, gl.DYNAMIC_DRAW);

        gl.useProgram(shaderProgram);
        bindAttribute(gl, positionBuffer, attribLocations.vertexPosition, 2);
        bindAttribute(gl, colorBuffer, attribLocations.vertexColor, 4);

        if (pointsCount > 0) {
            gl.drawArrays(gl.POINTS, pointsOffset, pointsCount);
        }

        if (trianglesCount > 0) {
            gl.drawArrays(gl.TRIANGLES, trianglesOffset, trianglesCount);
        }

        for (const batch of circleBatches) {
            gl.drawArrays(gl.TRIANGLE_FAN, batch.offset, batch.count);
        }
    };

    canvas.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;

        const { x, y } = getCanvasNdcCoords(event);
        const color = hexToRgba(drawColorSelect.value);

        if (state.mode === 'point') {
            const index = addVertex(x, y, color);
            state.pointIndices.push(index);
        } else if (state.mode === 'triangle') {
            const index = addVertex(x, y, color);
            state.triangleIndices.push(index);
        } else if (state.mode === 'circle') {
            if (state.pendingCircleCenterIndex === null) {
                const centerIndex = addVertex(x, y, color);
                state.pointIndices.push(centerIndex);
                state.pendingCircleCenterIndex = centerIndex;
            } else {
                addCircleFromPendingCenter(state.pendingCircleCenterIndex, x, y, color);
                state.pendingCircleCenterIndex = null;
            }
        }

        updateStatusHint();
        render();
    });

    for (const btn of modeButtons) {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    }

    clearBtn.addEventListener('click', () => {
        state.vertices = [];
        state.pointIndices = [];
        state.triangleIndices = [];
        state.circleIndices = [];
        state.pendingCircleCenterIndex = null;
        state.clearColor = hexToRgba(bgColorSelect.value);

        updateStatusHint();
        render();
    });

    updateStatusHint();
    render();
};

window.addEventListener('load', initApp);
