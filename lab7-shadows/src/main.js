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
    multiplyMatrices,
} from '../../shared/math.js';
import {
    createTexturedQuad,
    createTexturedCube,
} from './geometry.js';
import {
    createWoodenCrateCanvas,
    createBrickWallCanvas,
    canvasToImage,
    fileToImage,
} from './textures.js';

const TEXTURE_MODE_LABELS = [
    'Texture 1: Wooden Crate (TEXTURE0)',
    'Texture 2: Brick Wall (TEXTURE1)',
    'Multi-Texture Blend: Crate + Brick Wall (TEXTURE0 + TEXTURE1)',
];

const DEFAULT_STATE = Object.freeze({
    shape: 'cube',
    textureMode: 0,
    autoRotate: true,
    angleX: 0.35,
    angleY: 0.55,
});

const vsSource = `
    attribute vec3 aVertexPosition;
    attribute vec2 aTexCoord;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying highp vec2 vTexCoord;

    void main() {
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
        vTexCoord = aTexCoord;
    }
`;

const fsSource = `
    precision mediump float;

    varying highp vec2 vTexCoord;

    uniform sampler2D uSampler0;
    uniform sampler2D uSampler1;
    uniform int uTextureMode;

    void main() {
        vec4 tex0 = texture2D(uSampler0, vTexCoord);
        vec4 tex1 = texture2D(uSampler1, vTexCoord);

        if (uTextureMode == 0) {
            gl_FragColor = tex0;
        } else if (uTextureMode == 1) {
            gl_FragColor = tex1;
        } else {
            gl_FragColor = mix(tex0, tex1, 0.45);
        }
    }
`;

const isPowerOfTwo = (value) => (value & (value - 1)) === 0;

const uploadTextureImage = (gl, texture, textureUnit, image) => {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0 + textureUnit);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    if (isPowerOfTwo(image.width) && isPowerOfTwo(image.height)) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
};

const createMeshBuffers = (gl, mesh) => ({
    positionBuffer: createAndBindBuffer(gl, mesh.positions),
    texCoordBuffer: createAndBindBuffer(gl, mesh.texCoords),
    indexBuffer: createIndexBuffer(gl, mesh.indices),
    vertexCount: mesh.vertexCount,
});

const initApp = async () => {
    const gl = setupWebGL('glcanvas');
    if (!gl) return;

    const canvas = gl.canvas;
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    if (!shaderProgram) return;

    const attribLocations = {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        texCoord: gl.getAttribLocation(shaderProgram, 'aTexCoord'),
    };

    const uniformLocations = {
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        sampler0: gl.getUniformLocation(shaderProgram, 'uSampler0'),
        sampler1: gl.getUniformLocation(shaderProgram, 'uSampler1'),
        textureMode: gl.getUniformLocation(shaderProgram, 'uTextureMode'),
    };

    const meshes = {
        cube: createMeshBuffers(gl, createTexturedCube()),
        quad: createMeshBuffers(gl, createTexturedQuad()),
    };

    const textures = [gl.createTexture(), gl.createTexture()];
    const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);

    const loadDefaultTextures = async () => {
        const [crateImg, brickImg] = await Promise.all([
            canvasToImage(createWoodenCrateCanvas()),
            canvasToImage(createBrickWallCanvas()),
        ]);
        uploadTextureImage(gl, textures[0], 0, crateImg);
        uploadTextureImage(gl, textures[1], 1, brickImg);
    };

    await loadDefaultTextures();

    const state = structuredClone(DEFAULT_STATE);

    const shapeSelect = document.getElementById('shapeSelect');
    const texButtons = document.querySelectorAll('.tex-btn');
    const rotateToggle = document.getElementById('rotateToggle');
    const uploadTex1 = document.getElementById('uploadTex1');
    const uploadTex2 = document.getElementById('uploadTex2');
    const resetBtn = document.getElementById('resetBtn');
    const statusHint = document.getElementById('statusHint');

    const syncUi = () => {
        shapeSelect.value = state.shape;
        rotateToggle.checked = state.autoRotate;

        for (const btn of texButtons) {
            const isActive = Number(btn.dataset.mode) === state.textureMode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        }

        statusHint.textContent =
            `${TEXTURE_MODE_LABELS[state.textureMode]} | Click canvas to cycle texture | ` +
            `GPU Texture Units: ${maxTextureUnits}`;
    };

    const setTextureMode = (mode) => {
        state.textureMode = mode % 3;
        syncUi();
    };

    canvas.addEventListener('click', () => {
        setTextureMode(state.textureMode + 1);
    });

    for (const btn of texButtons) {
        btn.addEventListener('click', () => setTextureMode(Number(btn.dataset.mode)));
    }

    shapeSelect.addEventListener('change', (e) => {
        state.shape = e.target.value;
        syncUi();
    });

    rotateToggle.addEventListener('change', (e) => {
        state.autoRotate = e.target.checked;
    });

    const handleUpload = (input, unit) => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const img = await fileToImage(file);
            uploadTextureImage(gl, textures[unit], unit, img);
            setTextureMode(unit);
        });
    };

    handleUpload(uploadTex1, 0);
    handleUpload(uploadTex2, 1);

    resetBtn.addEventListener('click', async () => {
        Object.assign(state, structuredClone(DEFAULT_STATE));
        uploadTex1.value = '';
        uploadTex2.value = '';
        await loadDefaultTextures();
        syncUi();
    });

    gl.useProgram(shaderProgram);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.uniform1i(uniformLocations.sampler0, 0);
    gl.uniform1i(uniformLocations.sampler1, 1);

    syncUi();

    let lastTimestamp = null;

    const render = (now) => {
        if (lastTimestamp === null) {
            lastTimestamp = now;
        }
        const dt = Math.min((now - lastTimestamp) * 0.001, 0.1);
        lastTimestamp = now;

        const isCube = state.shape === 'cube';
        if (isCube && state.autoRotate) {
            state.angleY += dt * 0.70;
            state.angleX += dt * 0.35;
        }

        const aspect = canvas.width / canvas.height;
        let projectionMatrix;
        let modelViewMatrix;

        if (isCube) {
            projectionMatrix = createPerspectiveMatrix((45 * Math.PI) / 180, aspect, 0.1, 20.0);
            const rot = multiplyMatrices(
                createYRotationMatrix(state.angleY),
                createXRotationMatrix(state.angleX),
            );
            modelViewMatrix = multiplyMatrices(createTranslationMatrix(0.0, 0.0, -3.4), rot);
        } else {
            projectionMatrix = createIdentityMatrix();
            modelViewMatrix = createIdentityMatrix();
        }

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.04, 0.06, 0.11, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const mesh = meshes[state.shape];
        bindAttribute(gl, mesh.positionBuffer, attribLocations.vertexPosition, 3);
        bindAttribute(gl, mesh.texCoordBuffer, attribLocations.texCoord, 2);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

        gl.uniformMatrix4fv(uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(uniformLocations.modelViewMatrix, false, modelViewMatrix);
        gl.uniform1i(uniformLocations.textureMode, state.textureMode);

        gl.drawElements(gl.TRIANGLES, mesh.vertexCount, gl.UNSIGNED_SHORT, 0);

        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
};

window.addEventListener('load', initApp);
