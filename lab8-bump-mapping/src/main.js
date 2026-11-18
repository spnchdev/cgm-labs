import {
    setupWebGL,
    initShaderProgram,
    createAndBindBuffer,
    createIndexBuffer,
    bindAttribute,
} from '../../shared/gl-utils.js';
import {
    createTranslationMatrix,
    createScalingMatrix,
    createOrthographicMatrix,
    createPerspectiveMatrix,
    createLookAtMatrix,
    createNormalMatrix,
    multiplyMatrices,
} from '../../shared/math.js';
import { createBoxGeometry } from './geometry.js';

const SHADOW_MAP_SIZE = 1024;

const DEFAULT_STATE = Object.freeze({
    shadowsEnabled: true,
    orbitLight: false,
    shadowOpacity: 0.58,
    cameraYawDeg: 32,
    lightOrbitAngle: 0.7,
    lightPos: { x: 2.8, y: 3.8, z: 2.4 },
});

// Pass 1: Light-space depth map shaders (packs depth into 4 RGBA channels)
const vsShadowSource = `
    attribute vec3 aPosition;

    uniform mat4 uModelMatrix;
    uniform mat4 uLightSpaceMatrix;

    void main() {
        gl_Position = uLightSpaceMatrix * uModelMatrix * vec4(aPosition, 1.0);
    }
`;

const fsShadowSource = `
    precision highp float;

    vec4 packDepth(const in float depth) {
        const vec4 bitShift = vec4(1.0, 255.0, 65025.0, 16581375.0);
        const vec4 bitMask  = vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
        vec4 res = fract(depth * bitShift);
        res -= res.yzww * bitMask;
        return res;
    }

    void main() {
        gl_FragColor = packDepth(gl_FragCoord.z);
    }
`;

// Pass 2: Main camera rendering with depth comparison and semi-transparent shadows
const vsSceneSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uNormalMatrix;
    uniform mat4 uLightSpaceMatrix;

    varying highp vec3 vWorldPos;
    varying highp vec3 vNormal;
    varying highp vec4 vLightSpacePos;

    void main() {
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize((uNormalMatrix * vec4(aNormal, 0.0)).xyz);
        vLightSpacePos = uLightSpaceMatrix * worldPos;
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    }
`;

const fsSceneSource = `
    precision highp float;

    varying highp vec3 vWorldPos;
    varying highp vec3 vNormal;
    varying highp vec4 vLightSpacePos;

    uniform sampler2D uShadowMap;
    uniform float uShadowMapSize;
    uniform vec3 uLightPos;
    uniform vec3 uCameraPos;
    uniform vec3 uBaseColor;
    uniform float uShadowOpacity;
    uniform int uShadowsEnabled;
    uniform int uIsGround;
    uniform int uIsEmissive;

    float unpackDepth(const in vec4 rgbaDepth) {
        const vec4 bitShift = vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0);
        return dot(rgbaDepth, bitShift);
    }

    float computeShadowFactor(vec3 normal, vec3 lightDir) {
        if (uShadowsEnabled == 0) {
            return 0.0;
        }

        // Perspective divide into NDC [-1, 1], then remap to [0, 1]
        vec3 ndc = vLightSpacePos.xyz / vLightSpacePos.w;
        vec3 percentages = ndc * 0.5 + 0.5;

        if (
            percentages.x < 0.0 || percentages.x > 1.0 ||
            percentages.y < 0.0 || percentages.y > 1.0 ||
            percentages.z > 1.0
        ) {
            return 0.0;
        }

        float bias = max(0.004 * (1.0 - max(dot(normal, lightDir), 0.0)), 0.0012);
        float texelSize = 1.0 / uShadowMapSize;
        float shadow = 0.0;

        // 3x3 PCF depth comparison for smooth semi-transparent shadows
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                vec2 offset = vec2(float(x), float(y)) * texelSize;
                float shadowMapDistance = unpackDepth(texture2D(uShadowMap, percentages.xy + offset));
                if (percentages.z - bias > shadowMapDistance) {
                    shadow += 1.0;
                }
            }
        }

        return shadow / 9.0;
    }

    void main() {
        if (uIsEmissive == 1) {
            gl_FragColor = vec4(uBaseColor, 1.0);
            return;
        }

        vec3 surfaceColor = uBaseColor;
        if (uIsGround == 1) {
            float checker = mod(floor(vWorldPos.x * 1.5) + floor(vWorldPos.z * 1.5), 2.0);
            surfaceColor = mix(uBaseColor * 0.84, uBaseColor * 1.08, checker);
        }

        vec3 N = normalize(vNormal);
        vec3 L = normalize(uLightPos - vWorldPos);
        vec3 V = normalize(uCameraPos - vWorldPos);
        vec3 R = reflect(-L, N);

        vec3 ambient = 0.24 * surfaceColor;
        float diff = max(dot(N, L), 0.0);
        vec3 diffuse = 0.78 * diff * surfaceColor;
        float spec = diff > 0.0 ? pow(max(dot(R, V), 0.0), 32.0) : 0.0;
        vec3 specular = 0.28 * spec * vec3(1.0);

        float shadow = computeShadowFactor(N, L);
        float visibility = 1.0 - shadow * uShadowOpacity;

        gl_FragColor = vec4(ambient + visibility * (diffuse + specular), 1.0);
    }
`;

const createShadowFramebuffer = (gl, size) => {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    const depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, depthTexture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('Shadow framebuffer is incomplete.');
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    return { fbo, depthTexture };
};

const composeModelMatrix = (tx, ty, tz, sx, sy, sz) => multiplyMatrices(
    createTranslationMatrix(tx, ty, tz),
    createScalingMatrix(sx, sy, sz),
);

const initApp = () => {
    const gl = setupWebGL('glcanvas');
    if (!gl) return;

    const canvas = gl.canvas;
    const shadowProgram = initShaderProgram(gl, vsShadowSource, fsShadowSource);
    const sceneProgram = initShaderProgram(gl, vsSceneSource, fsSceneSource);
    if (!shadowProgram || !sceneProgram) return;

    const shadowAttribs = {
        position: gl.getAttribLocation(shadowProgram, 'aPosition'),
    };
    const shadowUniforms = {
        modelMatrix: gl.getUniformLocation(shadowProgram, 'uModelMatrix'),
        lightSpaceMatrix: gl.getUniformLocation(shadowProgram, 'uLightSpaceMatrix'),
    };

    const sceneAttribs = {
        position: gl.getAttribLocation(sceneProgram, 'aPosition'),
        normal: gl.getAttribLocation(sceneProgram, 'aNormal'),
    };
    const sceneUniforms = {
        modelMatrix: gl.getUniformLocation(sceneProgram, 'uModelMatrix'),
        viewMatrix: gl.getUniformLocation(sceneProgram, 'uViewMatrix'),
        projectionMatrix: gl.getUniformLocation(sceneProgram, 'uProjectionMatrix'),
        normalMatrix: gl.getUniformLocation(sceneProgram, 'uNormalMatrix'),
        lightSpaceMatrix: gl.getUniformLocation(sceneProgram, 'uLightSpaceMatrix'),
        shadowMap: gl.getUniformLocation(sceneProgram, 'uShadowMap'),
        shadowMapSize: gl.getUniformLocation(sceneProgram, 'uShadowMapSize'),
        lightPos: gl.getUniformLocation(sceneProgram, 'uLightPos'),
        cameraPos: gl.getUniformLocation(sceneProgram, 'uCameraPos'),
        baseColor: gl.getUniformLocation(sceneProgram, 'uBaseColor'),
        shadowOpacity: gl.getUniformLocation(sceneProgram, 'uShadowOpacity'),
        shadowsEnabled: gl.getUniformLocation(sceneProgram, 'uShadowsEnabled'),
        isGround: gl.getUniformLocation(sceneProgram, 'uIsGround'),
        isEmissive: gl.getUniformLocation(sceneProgram, 'uIsEmissive'),
    };

    const box = createBoxGeometry(1.0);
    const positionBuffer = createAndBindBuffer(gl, box.positions);
    const normalBuffer = createAndBindBuffer(gl, box.normals);
    const indexBuffer = createIndexBuffer(gl, box.indices);

    const shadowFbo = createShadowFramebuffer(gl, SHADOW_MAP_SIZE);

    // Three required scene objects: 1 large ground rectangle + 2 smaller boxes on it
    const sceneObjects = [
        {
            name: 'ground',
            modelMatrix: composeModelMatrix(0.0, -0.1, 0.0, 7.0, 0.2, 7.0),
            color: [0.56, 0.42, 0.29],
            isGround: 1,
        },
        {
            name: 'box1',
            modelMatrix: composeModelMatrix(-1.05, 0.65, 0.25, 1.0, 1.3, 1.0),
            color: [0.88, 0.34, 0.26],
            isGround: 0,
        },
        {
            name: 'box2',
            modelMatrix: composeModelMatrix(0.95, 0.45, -0.25, 0.9, 0.9, 0.9),
            color: [0.24, 0.56, 0.92],
            isGround: 0,
        },
    ];

    const state = structuredClone(DEFAULT_STATE);

    const shadowsToggle = document.getElementById('shadowsToggle');
    const orbitLightToggle = document.getElementById('orbitLightToggle');
    const opacitySlider = document.getElementById('opacitySlider');
    const opacityValue = document.getElementById('opacityValue');
    const camAngleSlider = document.getElementById('camAngleSlider');
    const camAngleValue = document.getElementById('camAngleValue');
    const lightXSlider = document.getElementById('lightXSlider');
    const lightXValue = document.getElementById('lightXValue');
    const lightYSlider = document.getElementById('lightYSlider');
    const lightYValue = document.getElementById('lightYValue');
    const lightZSlider = document.getElementById('lightZSlider');
    const lightZValue = document.getElementById('lightZValue');
    const resetBtn = document.getElementById('resetBtn');
    const statusHint = document.getElementById('statusHint');

    const syncUi = () => {
        shadowsToggle.checked = state.shadowsEnabled;
        orbitLightToggle.checked = state.orbitLight;
        opacitySlider.disabled = !state.shadowsEnabled;
        opacitySlider.value = String(state.shadowOpacity);
        opacityValue.textContent = state.shadowOpacity.toFixed(2);
        camAngleSlider.value = String(state.cameraYawDeg);
        camAngleValue.textContent = `${state.cameraYawDeg}°`;
        lightXSlider.value = String(state.lightPos.x);
        lightXValue.textContent = state.lightPos.x.toFixed(1);
        lightYSlider.value = String(state.lightPos.y);
        lightYValue.textContent = state.lightPos.y.toFixed(1);
        lightZSlider.value = String(state.lightPos.z);
        lightZValue.textContent = state.lightPos.z.toFixed(1);

        statusHint.textContent =
            `Shadows: ${state.shadowsEnabled ? `ON (Opacity ${state.shadowOpacity.toFixed(2)})` : 'OFF'} | ` +
            `Light: (${state.lightPos.x.toFixed(1)}, ${state.lightPos.y.toFixed(1)}, ${state.lightPos.z.toFixed(1)})`;
    };

    shadowsToggle.addEventListener('change', (e) => {
        state.shadowsEnabled = e.target.checked;
        syncUi();
    });

    orbitLightToggle.addEventListener('change', (e) => {
        state.orbitLight = e.target.checked;
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

    bindSlider(opacitySlider, (val) => { state.shadowOpacity = val; });
    bindSlider(camAngleSlider, (val) => { state.cameraYawDeg = val; });
    bindSlider(lightXSlider, (val) => { state.lightPos.x = val; });
    bindSlider(lightYSlider, (val) => { state.lightPos.y = val; });
    bindSlider(lightZSlider, (val) => { state.lightPos.z = val; });

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

        if (state.orbitLight) {
            state.lightOrbitAngle += dt * 0.9;
            state.lightPos.x = Number((Math.cos(state.lightOrbitAngle) * 3.4).toFixed(1));
            state.lightPos.z = Number((Math.sin(state.lightOrbitAngle) * 3.4).toFixed(1));
            syncUi();
        }

        const lightPosArr = [state.lightPos.x, state.lightPos.y, state.lightPos.z];
        const lightView = createLookAtMatrix(lightPosArr, [0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
        const lightProj = createOrthographicMatrix(-4.8, 4.8, -4.8, 4.8, 0.5, 16.0);
        const lightSpaceMatrix = multiplyMatrices(lightProj, lightView);

        // --------------------------------------------------------------------
        // Pass 1: Render Depth Map from Light Perspective into Shadow FBO
        // --------------------------------------------------------------------
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo.fbo);
        gl.viewport(0, 0, SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(shadowProgram);
        bindAttribute(gl, positionBuffer, shadowAttribs.position, 3);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.uniformMatrix4fv(shadowUniforms.lightSpaceMatrix, false, lightSpaceMatrix);

        for (const obj of sceneObjects) {
            gl.uniformMatrix4fv(shadowUniforms.modelMatrix, false, obj.modelMatrix);
            gl.drawElements(gl.TRIANGLES, box.vertexCount, gl.UNSIGNED_SHORT, 0);
        }

        // --------------------------------------------------------------------
        // Pass 2: Render Lit Scene + Semi-Transparent Shadows from Camera POV
        // --------------------------------------------------------------------
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.04, 0.06, 0.11, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const yawRad = (state.cameraYawDeg * Math.PI) / 180;
        const camDist = 6.8;
        const cameraPos = [
            Math.sin(yawRad) * camDist,
            4.1,
            Math.cos(yawRad) * camDist,
        ];
        const viewMatrix = createLookAtMatrix(cameraPos, [0.0, 0.3, 0.0], [0.0, 1.0, 0.0]);
        const projectionMatrix = createPerspectiveMatrix((45 * Math.PI) / 180, canvas.width / canvas.height, 0.5, 30.0);

        gl.useProgram(sceneProgram);
        bindAttribute(gl, positionBuffer, sceneAttribs.position, 3);
        bindAttribute(gl, normalBuffer, sceneAttribs.normal, 3);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, shadowFbo.depthTexture);
        gl.uniform1i(sceneUniforms.shadowMap, 0);
        gl.uniform1f(sceneUniforms.shadowMapSize, SHADOW_MAP_SIZE);

        gl.uniformMatrix4fv(sceneUniforms.viewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(sceneUniforms.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(sceneUniforms.lightSpaceMatrix, false, lightSpaceMatrix);
        gl.uniform3f(sceneUniforms.lightPos, ...lightPosArr);
        gl.uniform3f(sceneUniforms.cameraPos, ...cameraPos);
        gl.uniform1f(sceneUniforms.shadowOpacity, state.shadowOpacity);
        gl.uniform1i(sceneUniforms.shadowsEnabled, state.shadowsEnabled ? 1 : 0);

        gl.uniform1i(sceneUniforms.isEmissive, 0);
        for (const obj of sceneObjects) {
            gl.uniformMatrix4fv(sceneUniforms.modelMatrix, false, obj.modelMatrix);
            gl.uniformMatrix4fv(sceneUniforms.normalMatrix, false, createNormalMatrix(obj.modelMatrix));
            gl.uniform3f(sceneUniforms.baseColor, ...obj.color);
            gl.uniform1i(sceneUniforms.isGround, obj.isGround);
            gl.drawElements(gl.TRIANGLES, box.vertexCount, gl.UNSIGNED_SHORT, 0);
        }

        // Draw visible glowing marker cube at the light source position
        const lightMarkerModel = composeModelMatrix(...lightPosArr, 0.22, 0.22, 0.22);
        gl.uniformMatrix4fv(sceneUniforms.modelMatrix, false, lightMarkerModel);
        gl.uniformMatrix4fv(sceneUniforms.normalMatrix, false, createNormalMatrix(lightMarkerModel));
        gl.uniform3f(sceneUniforms.baseColor, 1.0, 0.94, 0.65);
        gl.uniform1i(sceneUniforms.isGround, 0);
        gl.uniform1i(sceneUniforms.isEmissive, 1);
        gl.drawElements(gl.TRIANGLES, box.vertexCount, gl.UNSIGNED_SHORT, 0);

        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
};

window.addEventListener('load', initApp);
