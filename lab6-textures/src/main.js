import {
    setupWebGL,
    initShaderProgram,
    createAndBindBuffer,
    createIndexBuffer,
    bindAttribute,
} from '../../shared/gl-utils.js';
import {
    createIdentityMatrix,
    createXRotationMatrix,
    createYRotationMatrix,
    createTranslationMatrix,
    createPerspectiveMatrix,
    createNormalMatrix,
    multiplyMatrices,
} from '../../shared/math.js';
import {
    createTrefoilKnot,
    createLatheVase,
} from './geometry.js';

// ============================================================================
// 1. Default Application & Shading State
// ============================================================================

const DEFAULT_STATE = Object.freeze({
    shape: 'knot',
    shadingMode: 2, // 0 = Ambient, 1 = Lambert Diffuse, 2 = Full Phong
    autoRotate: true,
    angleX: 0.35,
    angleY: 0.40,
    shininess: 42,
    ambientLevel: 0.20,
    specularLevel: 0.90,
    lightPos: { x: 2.5, y: 2.2, z: 3.0 },
});

// ============================================================================
// 2. GLSL Shaders: Eye-Space Transformations & Phong Surface Shading
// ============================================================================

const vsSource = `
    attribute vec3 a_coords;
    attribute vec3 a_colors;
    attribute vec3 a_normal;

    uniform mat4 u_T;
    uniform mat4 u_Rx;
    uniform mat4 u_Ry;
    uniform mat4 u_Basis;
    uniform mat4 u_Eye;
    uniform mat4 u_Pers;
    uniform mat4 u_NormalMatrix;

    varying highp vec3 v_normal;
    varying highp vec3 v_coords;
    varying lowp vec3 v_color;

    void main() {
        // Compose Model (M), View/Camera (V), and Perspective (P) matrices
        mat4 M = u_T * u_Ry * u_Rx;
        mat4 V = u_Basis * u_Eye;
        mat4 MV = V * M;

        vec4 eyePosition = MV * vec4(a_coords, 1.0);
        gl_Position = u_Pers * eyePosition;

        // Pass eye-space coordinates, transformed normals, and vertex colors
        v_coords = eyePosition.xyz;
        v_normal = normalize((u_NormalMatrix * vec4(a_normal, 0.0)).xyz);
        v_color = a_colors;
    }
`;

const fsSource = `
    precision highp float;

    varying highp vec3 v_normal;
    varying highp vec3 v_coords;
    varying lowp vec3 v_color;

    uniform vec3 u_LightColor;
    uniform vec3 u_LightPosition;
    uniform vec3 u_AmbientLight;
    uniform float u_SpecularStrength;
    uniform float u_Shininess;
    uniform int u_ShadingMode;

    void main() {
        vec3 n = normalize(v_normal);
        vec3 l = normalize(u_LightPosition - v_coords);
        vec3 e = normalize(-v_coords);
        vec3 r = reflect(-l, n);

        // Ambient term: c_r * c_a
        vec3 ambient = v_color * u_AmbientLight;
        if (u_ShadingMode == 0) {
            gl_FragColor = vec4(ambient, 1.0);
            return;
        }

        // Diffuse (Lambertian) term: c_r * c_l * max(0, n . l)
        float nDotL = max(dot(n, l), 0.0);
        vec3 diffuse = v_color * u_LightColor * nDotL;
        if (u_ShadingMode == 1) {
            gl_FragColor = vec4(ambient + diffuse, 1.0);
            return;
        }

        // Specular highlight (Phong) term: c_l * c_p * max(0, e . r)^p
        float specFactor = nDotL > 0.0 ? pow(max(dot(e, r), 0.0), u_Shininess) : 0.0;
        vec3 specular = u_LightColor * u_SpecularStrength * specFactor;

        gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
    }
`;

// ============================================================================
// 3. GPU Buffer Upload Helper
// ============================================================================

const createMeshBuffers = (gl, mesh) => ({
    positionBuffer: createAndBindBuffer(gl, mesh.positions),
    colorBuffer: createAndBindBuffer(gl, mesh.colors),
    normalBuffer: createAndBindBuffer(gl, mesh.normals),
    indexBuffer: createIndexBuffer(gl, mesh.indices),
    vertexCount: mesh.vertexCount,
});

// ============================================================================
// 4. Main Application Setup, Event Bindings & Render Loop
// ============================================================================

const initApp = () => {
    // Initialize WebGL context and compile/link GLSL shader program
    const gl = setupWebGL('glcanvas');
    if (!gl) return;

    const canvas = gl.canvas;
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    if (!shaderProgram) return;

    // Look up vertex attribute and uniform locations
    const attribLocations = {
        coords: gl.getAttribLocation(shaderProgram, 'a_coords'),
        colors: gl.getAttribLocation(shaderProgram, 'a_colors'),
        normal: gl.getAttribLocation(shaderProgram, 'a_normal'),
    };

    const uniformLocations = {
        t: gl.getUniformLocation(shaderProgram, 'u_T'),
        rx: gl.getUniformLocation(shaderProgram, 'u_Rx'),
        ry: gl.getUniformLocation(shaderProgram, 'u_Ry'),
        basis: gl.getUniformLocation(shaderProgram, 'u_Basis'),
        eye: gl.getUniformLocation(shaderProgram, 'u_Eye'),
        pers: gl.getUniformLocation(shaderProgram, 'u_Pers'),
        normalMatrix: gl.getUniformLocation(shaderProgram, 'u_NormalMatrix'),
        lightColor: gl.getUniformLocation(shaderProgram, 'u_LightColor'),
        lightPosition: gl.getUniformLocation(shaderProgram, 'u_LightPosition'),
        ambientLight: gl.getUniformLocation(shaderProgram, 'u_AmbientLight'),
        specularStrength: gl.getUniformLocation(shaderProgram, 'u_SpecularStrength'),
        shininess: gl.getUniformLocation(shaderProgram, 'u_Shininess'),
        shadingMode: gl.getUniformLocation(shaderProgram, 'u_ShadingMode'),
    };

    // Build GPU buffers for both arbitrary 3D figures
    const meshes = {
        knot: createMeshBuffers(gl, createTrefoilKnot()),
        vase: createMeshBuffers(gl, createLatheVase()),
    };

    const state = structuredClone(DEFAULT_STATE);
    const basisMat = createIdentityMatrix();
    const modelTransMat = createTranslationMatrix(0.0, 0.0, 0.0);
    const eyeMat = createTranslationMatrix(0.0, 0.0, -4.0);

    // Query UI controls
    const shapeSelect = document.getElementById('shapeSelect');
    const shadingSelect = document.getElementById('shadingSelect');
    const rotateToggle = document.getElementById('rotateToggle');
    const resetBtn = document.getElementById('resetBtn');
    const shininessSlider = document.getElementById('shininessSlider');
    const shininessValue = document.getElementById('shininessValue');
    const ambientSlider = document.getElementById('ambientSlider');
    const ambientValue = document.getElementById('ambientValue');
    const specularSlider = document.getElementById('specularSlider');
    const specularValue = document.getElementById('specularValue');
    const lightXSlider = document.getElementById('lightXSlider');
    const lightXValue = document.getElementById('lightXValue');
    const lightYSlider = document.getElementById('lightYSlider');
    const lightYValue = document.getElementById('lightYValue');
    const lightZSlider = document.getElementById('lightZSlider');
    const lightZValue = document.getElementById('lightZValue');
    const statusHint = document.getElementById('statusHint');

    // Synchronize DOM controls and status text with current state
    const syncUi = () => {
        shapeSelect.value = state.shape;
        shadingSelect.value = String(state.shadingMode);
        rotateToggle.checked = state.autoRotate;

        shininessSlider.value = String(state.shininess);
        shininessValue.textContent = String(state.shininess);
        ambientSlider.value = String(state.ambientLevel);
        ambientValue.textContent = state.ambientLevel.toFixed(2);
        specularSlider.value = String(state.specularLevel);
        specularValue.textContent = state.specularLevel.toFixed(2);

        lightXSlider.value = String(state.lightPos.x);
        lightXValue.textContent = state.lightPos.x.toFixed(1);
        lightYSlider.value = String(state.lightPos.y);
        lightYValue.textContent = state.lightPos.y.toFixed(1);
        lightZSlider.value = String(state.lightPos.z);
        lightZValue.textContent = state.lightPos.z.toFixed(1);

        const modeLabels = ['Ambient Only', 'Lambert (Ambient + Diffuse)', 'Phong (Ambient + Diffuse + Specular)'];
        statusHint.textContent =
            `Mode: ${modeLabels[state.shadingMode]} | p = ${state.shininess} | ` +
            `c_a = ${state.ambientLevel.toFixed(2)}, c_p = ${state.specularLevel.toFixed(2)}`;
    };

    // Attach UI event listeners
    shapeSelect.addEventListener('change', (e) => {
        state.shape = e.target.value;
        syncUi();
    });

    shadingSelect.addEventListener('change', (e) => {
        state.shadingMode = Number(e.target.value);
        syncUi();
    });

    rotateToggle.addEventListener('change', (e) => {
        state.autoRotate = e.target.checked;
    });

    resetBtn.addEventListener('click', () => {
        Object.assign(state, structuredClone(DEFAULT_STATE));
        syncUi();
    });

    const bindSlider = (slider, onUpdate) => {
        slider.addEventListener('input', (e) => {
            onUpdate(Number(e.target.value));
            syncUi();
        });
    };

    bindSlider(shininessSlider, (val) => { state.shininess = val; });
    bindSlider(ambientSlider, (val) => { state.ambientLevel = val; });
    bindSlider(specularSlider, (val) => { state.specularLevel = val; });
    bindSlider(lightXSlider, (val) => { state.lightPos.x = val; });
    bindSlider(lightYSlider, (val) => { state.lightPos.y = val; });
    bindSlider(lightZSlider, (val) => { state.lightPos.z = val; });

    // Configure global WebGL pipeline state
    gl.useProgram(shaderProgram);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    syncUi();

    let lastTimestamp = null;

    // Frame-rate-independent animation and rendering loop
    const render = (now) => {
        if (lastTimestamp === null) {
            lastTimestamp = now;
        }
        const dt = Math.min((now - lastTimestamp) * 0.001, 0.1);
        lastTimestamp = now;

        if (state.autoRotate) {
            state.angleY += dt * 0.65;
            state.angleX += dt * 0.35;
        }

        // Compute model, view, perspective, and normal matrices on CPU
        const aspect = canvas.width / canvas.height;
        const rxMat = createXRotationMatrix(state.angleX);
        const ryMat = createYRotationMatrix(state.angleY);
        const persMat = createPerspectiveMatrix((48 * Math.PI) / 180, aspect, 0.5, 20.0);

        const modelMat = multiplyMatrices(modelTransMat, multiplyMatrices(ryMat, rxMat));
        const viewMat = multiplyMatrices(basisMat, eyeMat);
        const normalMat = createNormalMatrix(multiplyMatrices(viewMat, modelMat));

        // Clear color and depth buffers
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.035, 0.05, 0.09, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Bind selected figure's vertex attributes and index buffer
        const mesh = meshes[state.shape];
        bindAttribute(gl, mesh.positionBuffer, attribLocations.coords, 3);
        bindAttribute(gl, mesh.colorBuffer, attribLocations.colors, 3);
        bindAttribute(gl, mesh.normalBuffer, attribLocations.normal, 3);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

        // Upload transformation and shading uniforms
        gl.uniformMatrix4fv(uniformLocations.t, false, modelTransMat);
        gl.uniformMatrix4fv(uniformLocations.rx, false, rxMat);
        gl.uniformMatrix4fv(uniformLocations.ry, false, ryMat);
        gl.uniformMatrix4fv(uniformLocations.basis, false, basisMat);
        gl.uniformMatrix4fv(uniformLocations.eye, false, eyeMat);
        gl.uniformMatrix4fv(uniformLocations.pers, false, persMat);
        gl.uniformMatrix4fv(uniformLocations.normalMatrix, false, normalMat);

        gl.uniform3f(uniformLocations.lightColor, 1.0, 1.0, 1.0);
        gl.uniform3f(uniformLocations.lightPosition, state.lightPos.x, state.lightPos.y, state.lightPos.z);
        gl.uniform3f(uniformLocations.ambientLight, state.ambientLevel, state.ambientLevel, state.ambientLevel);
        gl.uniform1f(uniformLocations.specularStrength, state.specularLevel);
        gl.uniform1f(uniformLocations.shininess, state.shininess);
        gl.uniform1i(uniformLocations.shadingMode, state.shadingMode);

        // Execute indexed draw call
        gl.drawElements(gl.TRIANGLES, mesh.vertexCount, gl.UNSIGNED_SHORT, 0);

        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
};

window.addEventListener('load', initApp);
