import {
    setupWebGL,
    initShaderProgram,
    createAndBindBuffer,
    createIndexBuffer,
    bindAttribute,
} from '../../shared/gl-utils.js';
import {
    createXRotationMatrix,
    createYRotationMatrix,
    createZRotationMatrix,
    createTranslationMatrix,
    createScalingMatrix,
    createOrthographicMatrix,
    createPerspectiveMatrix,
    multiplyMatrices,
} from '../../shared/math.js';
import { createCube } from './geometry.js';

const DEFAULT_STATE = Object.freeze({
    projection: 'orthographic',
    fovDegrees: 45,
    isPlaying: true,
    speed: 1.0,
    baseScale: 1.0,
    pulseEnabled: false,
    orbitEnabled: false,
    axes: { x: true, y: true, z: false },
    angles: { x: 0.55, y: 0.70, z: 0.0 },
    elapsedMotionTime: 0.0,
});

const vsSource = `
    attribute vec3 aVertexPosition;
    attribute vec4 aVertexColor;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying lowp vec4 vColor;

    void main() {
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
        vColor = aVertexColor;
    }
`;

const fsSource = `
    varying lowp vec4 vColor;

    void main() {
        gl_FragColor = vColor;
    }
`;

const composeMatrices = (...matrices) =>
    matrices.reduce((acc, next) => multiplyMatrices(acc, next));

const buildProjectionMatrix = (state, aspect) => {
    if (state.projection === 'orthographic') {
        const halfHeight = 1.9;
        const halfWidth = halfHeight * aspect;
        return createOrthographicMatrix(-halfWidth, halfWidth, -halfHeight, halfHeight, 0.1, 20.0);
    }

    const fovRadians = (state.fovDegrees * Math.PI) / 180;
    return createPerspectiveMatrix(fovRadians, aspect, 0.1, 20.0);
};

const buildModelViewMatrix = (state) => {
    const t = state.elapsedMotionTime;
    const tx = state.orbitEnabled ? Math.sin(t * 1.4) * 0.85 : 0.0;
    const ty = state.orbitEnabled ? Math.cos(t * 2.1) * 0.45 : 0.0;
    const tz = -4.6 + (state.orbitEnabled ? Math.cos(t * 1.4) * 1.35 : 0.0);

    const pulseFactor = state.pulseEnabled ? 1.0 + Math.sin(t * 3.0) * 0.22 : 1.0;
    const s = state.baseScale * pulseFactor;

    return composeMatrices(
        createTranslationMatrix(tx, ty, tz),
        createZRotationMatrix(state.angles.z),
        createYRotationMatrix(state.angles.y),
        createXRotationMatrix(state.angles.x),
        createScalingMatrix(s, s, s),
    );
};

const initApp = () => {
    const gl = setupWebGL('glcanvas');
    if (!gl) return;

    const canvas = gl.canvas;
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    if (!shaderProgram) return;

    const attribLocations = {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
    };

    const uniformLocations = {
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
    };

    const cube = createCube(1.4);
    const positionBuffer = createAndBindBuffer(gl, cube.positions);
    const colorBuffer = createAndBindBuffer(gl, cube.colors);
    const indexBuffer = createIndexBuffer(gl, cube.indices);

    const projButtons = document.querySelectorAll('.proj-btn');
    const fovSlider = document.getElementById('fovSlider');
    const fovValue = document.getElementById('fovValue');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const axisXCheckbox = document.getElementById('axisX');
    const axisYCheckbox = document.getElementById('axisY');
    const axisZCheckbox = document.getElementById('axisZ');
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const scaleSlider = document.getElementById('scaleSlider');
    const scaleValue = document.getElementById('scaleValue');
    const pulseToggle = document.getElementById('pulseToggle');
    const orbitToggle = document.getElementById('orbitToggle');
    const statusHint = document.getElementById('statusHint');

    const state = structuredClone(DEFAULT_STATE);

    const syncControlsFromState = () => {
        for (const btn of projButtons) {
            const isActive = btn.dataset.projection === state.projection;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        }

        const isPerspective = state.projection === 'perspective';
        fovSlider.disabled = !isPerspective;
        fovSlider.value = String(state.fovDegrees);
        fovValue.textContent = `${state.fovDegrees}°`;

        playPauseBtn.textContent = state.isPlaying ? 'Pause' : 'Play';

        axisXCheckbox.checked = state.axes.x;
        axisYCheckbox.checked = state.axes.y;
        axisZCheckbox.checked = state.axes.z;

        speedSlider.value = String(state.speed);
        speedValue.textContent = `${state.speed.toFixed(1)}x`;

        scaleSlider.value = String(state.baseScale);
        scaleValue.textContent = state.baseScale.toFixed(2);

        pulseToggle.checked = state.pulseEnabled;
        orbitToggle.checked = state.orbitEnabled;
    };

    const updateStatusHint = () => {
        const toDeg = (rad) => Math.round(((rad * 180) / Math.PI) % 360);
        const projLabel = state.projection === 'orthographic'
            ? 'Orthographic (parallel lines preserved)'
            : `Perspective (FOV ${state.fovDegrees}°)`;

        statusHint.textContent =
            `${projLabel} | Rot: (${toDeg(state.angles.x)}°, ${toDeg(state.angles.y)}°, ${toDeg(state.angles.z)}°) | ` +
            `Scale: ${state.baseScale.toFixed(2)} | ${state.isPlaying ? 'Animating' : 'Paused'}`;
    };

    for (const btn of projButtons) {
        btn.addEventListener('click', () => {
            state.projection = btn.dataset.projection;
            syncControlsFromState();
            updateStatusHint();
        });
    }

    fovSlider.addEventListener('input', (e) => {
        state.fovDegrees = Number(e.target.value);
        fovValue.textContent = `${state.fovDegrees}°`;
        updateStatusHint();
    });

    playPauseBtn.addEventListener('click', () => {
        state.isPlaying = !state.isPlaying;
        syncControlsFromState();
        updateStatusHint();
    });

    resetBtn.addEventListener('click', () => {
        Object.assign(state, structuredClone(DEFAULT_STATE));
        syncControlsFromState();
        updateStatusHint();
    });

    axisXCheckbox.addEventListener('change', (e) => { state.axes.x = e.target.checked; });
    axisYCheckbox.addEventListener('change', (e) => { state.axes.y = e.target.checked; });
    axisZCheckbox.addEventListener('change', (e) => { state.axes.z = e.target.checked; });

    speedSlider.addEventListener('input', (e) => {
        state.speed = Number(e.target.value);
        speedValue.textContent = `${state.speed.toFixed(1)}x`;
    });

    scaleSlider.addEventListener('input', (e) => {
        state.baseScale = Number(e.target.value);
        scaleValue.textContent = state.baseScale.toFixed(2);
        updateStatusHint();
    });

    pulseToggle.addEventListener('change', (e) => { state.pulseEnabled = e.target.checked; });
    orbitToggle.addEventListener('change', (e) => { state.orbitEnabled = e.target.checked; });

    gl.useProgram(shaderProgram);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    bindAttribute(gl, positionBuffer, attribLocations.vertexPosition, 3);
    bindAttribute(gl, colorBuffer, attribLocations.vertexColor, 4);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    syncControlsFromState();
    updateStatusHint();

    let lastTimestamp = null;

    const render = (now) => {
        if (lastTimestamp === null) {
            lastTimestamp = now;
        }
        const dt = Math.min((now - lastTimestamp) * 0.001, 0.1);
        lastTimestamp = now;

        if (state.isPlaying) {
            const angularStep = dt * state.speed;
            if (state.axes.x) state.angles.x += angularStep * 0.85;
            if (state.axes.y) state.angles.y += angularStep * 1.15;
            if (state.axes.z) state.angles.z += angularStep * 0.65;

            if (state.pulseEnabled || state.orbitEnabled) {
                state.elapsedMotionTime += angularStep;
            }
            updateStatusHint();
        }

        const aspect = canvas.width / canvas.height;
        const projectionMatrix = buildProjectionMatrix(state, aspect);
        const modelViewMatrix = buildModelViewMatrix(state);

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.04, 0.06, 0.10, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(uniformLocations.modelViewMatrix, false, modelViewMatrix);

        gl.drawElements(gl.TRIANGLES, cube.vertexCount, gl.UNSIGNED_SHORT, 0);

        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
};

window.addEventListener('load', initApp);
