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
    createTranslationMatrix,
    createPerspectiveMatrix,
    createNormalMatrix,
    multiplyMatrices,
} from '../../shared/math.js';
import {
    createTorus,
    createSphere,
} from './geometry.js';

const LIGHTING_PRESETS = Object.freeze({
    studio: {
        bgColor: '#0b1020',
        objectColor: '#3b82f6',
        lightColor: '#ffffff',
        ambient: 0.20,
        diffuse: 0.85,
        specular: 0.90,
        shininess: 48,
        lightPos: { x: 2.4, y: 2.2, z: 2.8 },
    },
    sunset: {
        bgColor: '#1b1024',
        objectColor: '#f97316',
        lightColor: '#ffd1a3',
        ambient: 0.22,
        diffuse: 0.95,
        specular: 1.05,
        shininess: 64,
        lightPos: { x: -2.8, y: 1.6, z: 2.2 },
    },
    neon: {
        bgColor: '#050b14',
        objectColor: '#ec4899',
        lightColor: '#22d3ee',
        ambient: 0.16,
        diffuse: 0.90,
        specular: 1.20,
        shininess: 96,
        lightPos: { x: 2.0, y: -1.8, z: 2.6 },
    },
    matte: {
        bgColor: '#1e293b',
        objectColor: '#22c55e',
        lightColor: '#f8fafc',
        ambient: 0.28,
        diffuse: 0.90,
        specular: 0.00,
        shininess: 16,
        lightPos: { x: 1.5, y: 2.5, z: 2.5 },
    },
});

const DEFAULT_STATE = Object.freeze({
    shape: 'torus',
    preset: 'studio',
    autoRotate: true,
    orbitLight: false,
    angleX: 0.45,
    angleY: 0.35,
    lightOrbitAngle: 0.0,
    ...structuredClone(LIGHTING_PRESETS.studio),
});

const vsSource = `
    attribute vec3 aVertexPosition;
    attribute vec3 aVertexNormal;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uNormalMatrix;

    varying highp vec3 vViewPosition;
    varying highp vec3 vNormal;

    void main() {
        vec4 mvPosition = uModelViewMatrix * vec4(aVertexPosition, 1.0);
        gl_Position = uProjectionMatrix * mvPosition;
        vViewPosition = mvPosition.xyz;
        vNormal = normalize((uNormalMatrix * vec4(aVertexNormal, 0.0)).xyz);
    }
`;

const fsSource = `
    precision highp float;

    varying highp vec3 vViewPosition;
    varying highp vec3 vNormal;

    uniform vec3 uLightPosition;
    uniform vec3 uLightColor;
    uniform vec3 uObjectColor;
    uniform float uAmbientStrength;
    uniform float uDiffuseStrength;
    uniform float uSpecularStrength;
    uniform float uShininess;

    void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uLightPosition - vViewPosition);
        vec3 V = normalize(-vViewPosition);
        vec3 R = reflect(-L, N);

        vec3 ambient = uAmbientStrength * uLightColor * uObjectColor;

        float diff = max(dot(N, L), 0.0);
        vec3 diffuse = uDiffuseStrength * diff * uLightColor * uObjectColor;

        float spec = diff > 0.0 ? pow(max(dot(R, V), 0.0), uShininess) : 0.0;
        vec3 specular = uSpecularStrength * spec * uLightColor;

        gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
    }
`;

const hexToRgb = (hex) => {
    const clean = hex.replace('#', '');
    return [
        Number.parseInt(clean.slice(0, 2), 16) / 255,
        Number.parseInt(clean.slice(2, 4), 16) / 255,
        Number.parseInt(clean.slice(4, 6), 16) / 255,
    ];
};

const createMeshBuffers = (gl, mesh) => ({
    positionBuffer: createAndBindBuffer(gl, mesh.positions),
    normalBuffer: createAndBindBuffer(gl, mesh.normals),
    indexBuffer: createIndexBuffer(gl, mesh.indices),
    vertexCount: mesh.vertexCount,
});

const initApp = () => {
    const gl = setupWebGL('glcanvas');
    if (!gl) return;

    const canvas = gl.canvas;
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    if (!shaderProgram) return;

    const attribLocations = {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        vertexNormal: gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
    };

    const uniformLocations = {
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        normalMatrix: gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
        lightPosition: gl.getUniformLocation(shaderProgram, 'uLightPosition'),
        lightColor: gl.getUniformLocation(shaderProgram, 'uLightColor'),
        objectColor: gl.getUniformLocation(shaderProgram, 'uObjectColor'),
        ambientStrength: gl.getUniformLocation(shaderProgram, 'uAmbientStrength'),
        diffuseStrength: gl.getUniformLocation(shaderProgram, 'uDiffuseStrength'),
        specularStrength: gl.getUniformLocation(shaderProgram, 'uSpecularStrength'),
        shininess: gl.getUniformLocation(shaderProgram, 'uShininess'),
    };

    const meshes = {
        torus: createMeshBuffers(gl, createTorus()),
        sphere: createMeshBuffers(gl, createSphere()),
    };

    const state = structuredClone(DEFAULT_STATE);

    const shapeSelect = document.getElementById('shapeSelect');
    const presetSelect = document.getElementById('presetSelect');
    const rotateToggle = document.getElementById('rotateToggle');
    const orbitLightToggle = document.getElementById('orbitLightToggle');
    const resetBtn = document.getElementById('resetBtn');
    const bgColorInput = document.getElementById('bgColorInput');
    const objectColorInput = document.getElementById('objectColorInput');
    const lightColorInput = document.getElementById('lightColorInput');
    const shininessSlider = document.getElementById('shininessSlider');
    const shininessValue = document.getElementById('shininessValue');
    const ambientSlider = document.getElementById('ambientSlider');
    const ambientValue = document.getElementById('ambientValue');
    const diffuseSlider = document.getElementById('diffuseSlider');
    const diffuseValue = document.getElementById('diffuseValue');
    const specularSlider = document.getElementById('specularSlider');
    const specularValue = document.getElementById('specularValue');
    const lightXSlider = document.getElementById('lightXSlider');
    const lightXValue = document.getElementById('lightXValue');
    const lightYSlider = document.getElementById('lightYSlider');
    const lightYValue = document.getElementById('lightYValue');
    const lightZSlider = document.getElementById('lightZSlider');
    const lightZValue = document.getElementById('lightZValue');
    const statusHint = document.getElementById('statusHint');

    const syncUi = () => {
        shapeSelect.value = state.shape;
        presetSelect.value = state.preset;
        rotateToggle.checked = state.autoRotate;
        orbitLightToggle.checked = state.orbitLight;
        bgColorInput.value = state.bgColor;
        objectColorInput.value = state.objectColor;
        lightColorInput.value = state.lightColor;

        shininessSlider.value = String(state.shininess);
        shininessValue.textContent = String(state.shininess);
        ambientSlider.value = String(state.ambient);
        ambientValue.textContent = state.ambient.toFixed(2);
        diffuseSlider.value = String(state.diffuse);
        diffuseValue.textContent = state.diffuse.toFixed(2);
        specularSlider.value = String(state.specular);
        specularValue.textContent = state.specular.toFixed(2);

        lightXSlider.value = String(state.lightPos.x);
        lightXValue.textContent = state.lightPos.x.toFixed(1);
        lightYSlider.value = String(state.lightPos.y);
        lightYValue.textContent = state.lightPos.y.toFixed(1);
        lightZSlider.value = String(state.lightPos.z);
        lightZValue.textContent = state.lightPos.z.toFixed(1);

        statusHint.textContent =
            `Phong Model — Ambient: ${state.ambient.toFixed(2)}, Diffuse: ${state.diffuse.toFixed(2)}, ` +
            `Specular: ${state.specular.toFixed(2)}, Shininess: ${state.shininess} | ` +
            `Light: (${state.lightPos.x.toFixed(1)}, ${state.lightPos.y.toFixed(1)}, ${state.lightPos.z.toFixed(1)})`;
    };

    const applyPreset = (presetKey) => {
        const preset = LIGHTING_PRESETS[presetKey];
        if (!preset) return;
        state.preset = presetKey;
        Object.assign(state, structuredClone(preset));
        syncUi();
    };

    shapeSelect.addEventListener('change', (e) => {
        state.shape = e.target.value;
        syncUi();
    });

    presetSelect.addEventListener('change', (e) => applyPreset(e.target.value));
    rotateToggle.addEventListener('change', (e) => { state.autoRotate = e.target.checked; });
    orbitLightToggle.addEventListener('change', (e) => { state.orbitLight = e.target.checked; });

    resetBtn.addEventListener('click', () => {
        Object.assign(state, structuredClone(DEFAULT_STATE));
        syncUi();
    });

    const bindInput = (input, onUpdate) => {
        input.addEventListener('input', (e) => {
            onUpdate(e.target.value);
            syncUi();
        });
    };

    bindInput(bgColorInput, (val) => { state.bgColor = val; });
    bindInput(objectColorInput, (val) => { state.objectColor = val; });
    bindInput(lightColorInput, (val) => { state.lightColor = val; });
    bindInput(shininessSlider, (val) => { state.shininess = Number(val); });
    bindInput(ambientSlider, (val) => { state.ambient = Number(val); });
    bindInput(diffuseSlider, (val) => { state.diffuse = Number(val); });
    bindInput(specularSlider, (val) => { state.specular = Number(val); });
    bindInput(lightXSlider, (val) => { state.lightPos.x = Number(val); });
    bindInput(lightYSlider, (val) => { state.lightPos.y = Number(val); });
    bindInput(lightZSlider, (val) => { state.lightPos.z = Number(val); });

    gl.useProgram(shaderProgram);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    syncUi();

    let lastTimestamp = null;

    const render = (now) => {
        if (lastTimestamp === null) {
            lastTimestamp = now;
        }
        const dt = Math.min((now - lastTimestamp) * 0.001, 0.1);
        lastTimestamp = now;

        if (state.autoRotate) {
            state.angleY += dt * 0.75;
            state.angleX += dt * 0.40;
        }

        if (state.orbitLight) {
            state.lightOrbitAngle += dt * 1.15;
            state.lightPos.x = Number((Math.cos(state.lightOrbitAngle) * 3.0).toFixed(1));
            state.lightPos.z = Number((Math.sin(state.lightOrbitAngle) * 3.0).toFixed(1));
            syncUi();
        }

        const aspect = canvas.width / canvas.height;
        const projectionMatrix = createPerspectiveMatrix((48 * Math.PI) / 180, aspect, 0.1, 20.0);

        const rotation = multiplyMatrices(
            createYRotationMatrix(state.angleY),
            createXRotationMatrix(state.angleX),
        );
        const modelViewMatrix = multiplyMatrices(
            createTranslationMatrix(0.0, 0.0, -3.6),
            rotation,
        );
        const normalMatrix = createNormalMatrix(modelViewMatrix);

        const bg = hexToRgb(state.bgColor);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(bg[0], bg[1], bg[2], 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const mesh = meshes[state.shape];
        bindAttribute(gl, mesh.positionBuffer, attribLocations.vertexPosition, 3);
        bindAttribute(gl, mesh.normalBuffer, attribLocations.vertexNormal, 3);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

        gl.uniformMatrix4fv(uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(uniformLocations.modelViewMatrix, false, modelViewMatrix);
        gl.uniformMatrix4fv(uniformLocations.normalMatrix, false, normalMatrix);

        gl.uniform3f(uniformLocations.lightPosition, state.lightPos.x, state.lightPos.y, state.lightPos.z);
        gl.uniform3fv(uniformLocations.lightColor, hexToRgb(state.lightColor));
        gl.uniform3fv(uniformLocations.objectColor, hexToRgb(state.objectColor));
        gl.uniform1f(uniformLocations.ambientStrength, state.ambient);
        gl.uniform1f(uniformLocations.diffuseStrength, state.diffuse);
        gl.uniform1f(uniformLocations.specularStrength, state.specular);
        gl.uniform1f(uniformLocations.shininess, state.shininess);

        gl.drawElements(gl.TRIANGLES, mesh.vertexCount, gl.UNSIGNED_SHORT, 0);

        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
};

window.addEventListener('load', initApp);
