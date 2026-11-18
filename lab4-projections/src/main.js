import {
    setupWebGL,
    initShaderProgram,
    createIndexBuffer,
} from '../../shared/gl-utils.js';
import {
    createIdentityMatrix,
    createXRotationMatrix,
    createYRotationMatrix,
    createTranslationMatrix,
    createScalingMatrix,
    createPerspectiveMatrix,
} from '../../shared/math.js';
import {
    createBoxGeometry,
    createCrateColors,
    createLidColors,
} from './geometry.js';

const DEG_TO_RAD = Math.PI / 180;
const Y_ROTATION_STEP = 6 * DEG_TO_RAD;
const LID_ANGLE_STEP = 5 * DEG_TO_RAD;
const MIN_LID_ANGLE = 0;
const MAX_LID_ANGLE = 115 * DEG_TO_RAD;

const DEFAULT_STATE = Object.freeze({
    thetaX: 30 * DEG_TO_RAD,
    thetaY: 30 * DEG_TO_RAD,
    lidAngle: 35 * DEG_TO_RAD,
    fov: 55,
    near: 0.5,
    far: 20.0,
    eye: { x: 0.0, y: 0.2, z: 3.5 },
});

const vsCrateSource = `
    attribute vec3 a_coords;
    attribute vec3 a_colors;

    uniform mat4 u_RotY;
    uniform mat4 u_RotX;
    uniform mat4 u_Scale;
    uniform mat4 u_Trans;
    uniform mat4 u_Basis;
    uniform mat4 u_Eye;
    uniform mat4 u_Pers;

    varying vec3 v_color;

    void main() {
        mat4 M = u_Trans * u_RotX * u_RotY * u_Scale;
        mat4 V = u_Basis * u_Eye;
        mat4 P = u_Pers;
        gl_Position = P * V * M * vec4(a_coords, 1.0);
        v_color = a_colors;
    }
`;

const fsCrateSource = `
    precision mediump float;
    varying vec3 v_color;

    void main() {
        gl_FragColor = vec4(v_color, 1.0);
    }
`;

const vsLidSource = `
    attribute vec3 a_coords;
    attribute vec3 a_colors;

    uniform mat4 u_RotY;
    uniform mat4 u_RotX;
    uniform mat4 u_Scale;
    uniform mat4 u_Trans;
    uniform mat4 u_LidPivot;
    uniform mat4 u_LidRotX;
    uniform mat4 u_Basis;
    uniform mat4 u_Eye;
    uniform mat4 u_Pers;

    varying vec3 v_color;

    void main() {
        mat4 M_lid_local = u_Trans * u_LidRotX * u_LidPivot * u_Scale;
        mat4 M = u_RotX * u_RotY * M_lid_local;
        mat4 V = u_Basis * u_Eye;
        mat4 P = u_Pers;
        gl_Position = P * V * M * vec4(a_coords, 1.0);
        v_color = a_colors;
    }
`;

const fsLidSource = `
    precision mediump float;
    varying vec3 v_color;

    void main() {
        gl_FragColor = vec4(v_color, 1.0);
    }
`;

const initApp = () => {
    const gl = setupWebGL('glcanvas');
    if (!gl) return;

    const canvas = gl.canvas;
    const box = createBoxGeometry(1.0);
    const crateColors = createCrateColors();
    const lidColors = createLidColors();

    const state = structuredClone(DEFAULT_STATE);
    const basisMat = createIdentityMatrix();

    let crateCtx = null;
    let lidCtx = null;

    const passAttribData = (data, att_buffer, loc) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, att_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc);
    };

    const bindExistingAttrib = (att_buffer, loc) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, att_buffer);
        gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc);
    };

    const rotate_X = (thetaX, loc) => {
        gl.uniformMatrix4fv(loc, false, createXRotationMatrix(thetaX));
    };

    const rotate_Y = (thetaY, loc) => {
        gl.uniformMatrix4fv(loc, false, createYRotationMatrix(thetaY));
    };

    const perspective = (aspect, fov, near, far, loc) => {
        gl.uniformMatrix4fv(loc, false, createPerspectiveMatrix(fov * DEG_TO_RAD, aspect, near, far));
    };

    const getCommonLocations = (program) => ({
        a_coords: gl.getAttribLocation(program, 'a_coords'),
        a_colors: gl.getAttribLocation(program, 'a_colors'),
        u_RotY: gl.getUniformLocation(program, 'u_RotY'),
        u_RotX: gl.getUniformLocation(program, 'u_RotX'),
        u_Scale: gl.getUniformLocation(program, 'u_Scale'),
        u_Trans: gl.getUniformLocation(program, 'u_Trans'),
        u_Basis: gl.getUniformLocation(program, 'u_Basis'),
        u_Eye: gl.getUniformLocation(program, 'u_Eye'),
        u_Pers: gl.getUniformLocation(program, 'u_Pers'),
    });

    const initGL_1 = () => {
        const program = initShaderProgram(gl, vsCrateSource, fsCrateSource);
        if (!program) return null;

        gl.useProgram(program);
        const locs = getCommonLocations(program);
        const coordsBuffer = gl.createBuffer();
        const colorsBuffer = gl.createBuffer();
        const indexBuffer = createIndexBuffer(gl, box.indices);

        passAttribData(box.positions, coordsBuffer, locs.a_coords);
        passAttribData(crateColors, colorsBuffer, locs.a_colors);

        return { program, locs, coordsBuffer, colorsBuffer, indexBuffer };
    };

    const initGL_2 = () => {
        const program = initShaderProgram(gl, vsLidSource, fsLidSource);
        if (!program) return null;

        gl.useProgram(program);
        const locs = {
            ...getCommonLocations(program),
            u_LidPivot: gl.getUniformLocation(program, 'u_LidPivot'),
            u_LidRotX: gl.getUniformLocation(program, 'u_LidRotX'),
        };
        const coordsBuffer = gl.createBuffer();
        const colorsBuffer = gl.createBuffer();
        const indexBuffer = createIndexBuffer(gl, box.indices);

        passAttribData(box.positions, coordsBuffer, locs.a_coords);
        passAttribData(lidColors, colorsBuffer, locs.a_colors);

        return { program, locs, coordsBuffer, colorsBuffer, indexBuffer };
    };

    const uploadSharedCameraAndPerspective = (locs) => {
        const aspect = canvas.width / canvas.height;
        const eyeMat = createTranslationMatrix(-state.eye.x, -state.eye.y, -state.eye.z);

        gl.uniformMatrix4fv(locs.u_Basis, false, basisMat);
        gl.uniformMatrix4fv(locs.u_Eye, false, eyeMat);
        perspective(aspect, state.fov, state.near, state.far, locs.u_Pers);
        rotate_X(state.thetaX, locs.u_RotX);
        rotate_Y(state.thetaY, locs.u_RotY);
    };

    const draw_crate = () => {
        const { program, locs, coordsBuffer, colorsBuffer, indexBuffer } = crateCtx;

        gl.useProgram(program);
        bindExistingAttrib(coordsBuffer, locs.a_coords);
        bindExistingAttrib(colorsBuffer, locs.a_colors);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        uploadSharedCameraAndPerspective(locs);
        gl.uniformMatrix4fv(locs.u_Scale, false, createScalingMatrix(1.0, 1.0, 1.0));
        gl.uniformMatrix4fv(locs.u_Trans, false, createTranslationMatrix(0.0, 0.0, 0.0));

        gl.drawElements(gl.TRIANGLES, box.vertexCount, gl.UNSIGNED_SHORT, 0);
    };

    const draw_lid = () => {
        const { program, locs, coordsBuffer, colorsBuffer, indexBuffer } = lidCtx;

        gl.useProgram(program);
        bindExistingAttrib(coordsBuffer, locs.a_coords);
        bindExistingAttrib(colorsBuffer, locs.a_colors);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        uploadSharedCameraAndPerspective(locs);
        // Lid reuses the exact same box coordinates, scaled thin along Y and hinged at back-top edge
        gl.uniformMatrix4fv(locs.u_Scale, false, createScalingMatrix(1.02, 0.12, 1.02));
        gl.uniformMatrix4fv(locs.u_LidPivot, false, createTranslationMatrix(0.0, 0.06, 0.51));
        rotate_X(-state.lidAngle, locs.u_LidRotX);
        gl.uniformMatrix4fv(locs.u_Trans, false, createTranslationMatrix(0.0, 0.502, -0.5));

        gl.drawElements(gl.TRIANGLES, box.vertexCount, gl.UNSIGNED_SHORT, 0);
    };

    const fovSlider = document.getElementById('fovSlider');
    const fovValue = document.getElementById('fovValue');
    const eyeXSlider = document.getElementById('eyeXSlider');
    const eyeXValue = document.getElementById('eyeXValue');
    const eyeYSlider = document.getElementById('eyeYSlider');
    const eyeYValue = document.getElementById('eyeYValue');
    const eyeZSlider = document.getElementById('eyeZSlider');
    const eyeZValue = document.getElementById('eyeZValue');
    const statusHint = document.getElementById('statusHint');

    const syncUi = () => {
        fovSlider.value = String(state.fov);
        fovValue.textContent = `${state.fov}°`;
        eyeXSlider.value = String(state.eye.x);
        eyeXValue.textContent = state.eye.x.toFixed(2);
        eyeYSlider.value = String(state.eye.y);
        eyeYValue.textContent = state.eye.y.toFixed(2);
        eyeZSlider.value = String(state.eye.z);
        eyeZValue.textContent = state.eye.z.toFixed(2);

        const toDeg = (rad) => Math.round((rad / DEG_TO_RAD) % 360);
        statusHint.textContent =
            `Rot X: ${toDeg(state.thetaX)}° | Rot Y: ${toDeg(state.thetaY)}° | ` +
            `Lid: ${Math.round(state.lidAngle / DEG_TO_RAD)}° | ` +
            `Keys: ←/→ rotate crate+lid, ↑/↓ open/close lid`;
    };

    const render = () => {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.04, 0.06, 0.10, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        draw_crate();
        draw_lid();
        syncUi();
    };

    const rotateAssemblyY = (delta) => {
        state.thetaY += delta;
        render();
    };

    const adjustLidAngle = (delta) => {
        state.lidAngle = Math.min(MAX_LID_ANGLE, Math.max(MIN_LID_ANGLE, state.lidAngle + delta));
        render();
    };

    crateCtx = initGL_1();
    lidCtx = initGL_2();
    if (!crateCtx || !lidCtx) return;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    document.getElementById('rotLeftBtn').addEventListener('click', () => rotateAssemblyY(-Y_ROTATION_STEP));
    document.getElementById('rotRightBtn').addEventListener('click', () => rotateAssemblyY(Y_ROTATION_STEP));
    document.getElementById('lidOpenBtn').addEventListener('click', () => adjustLidAngle(LID_ANGLE_STEP));
    document.getElementById('lidCloseBtn').addEventListener('click', () => adjustLidAngle(-LID_ANGLE_STEP));

    document.getElementById('resetBtn').addEventListener('click', () => {
        Object.assign(state, structuredClone(DEFAULT_STATE));
        render();
    });

    const bindSlider = (slider, onUpdate) => {
        slider.addEventListener('input', (e) => {
            onUpdate(Number(e.target.value));
            render();
        });
        slider.addEventListener('change', (e) => e.target.blur());
    };

    bindSlider(fovSlider, (val) => { state.fov = val; });
    bindSlider(eyeXSlider, (val) => { state.eye.x = val; });
    bindSlider(eyeYSlider, (val) => { state.eye.y = val; });
    bindSlider(eyeZSlider, (val) => { state.eye.z = val; });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            rotateAssemblyY(-Y_ROTATION_STEP);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            rotateAssemblyY(Y_ROTATION_STEP);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            adjustLidAngle(LID_ANGLE_STEP);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            adjustLidAngle(-LID_ANGLE_STEP);
        }
    });

    render();
};

window.addEventListener('load', initApp);
