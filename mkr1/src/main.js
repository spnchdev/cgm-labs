import {
    setupWebGL,
    initShaderProgram,
    createAndBindBuffer,
    bindAttribute,
} from '../../shared/gl-utils.js';
import {
    createZRotationMatrix,
    createTranslationMatrix,
    createScalingMatrix,
    multiplyMatrices,
} from '../../shared/math.js';
import {
    createLetterK,
    createLetterD,
    createLetterO,
} from './geometry.js';

const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;

    uniform mat4 uTransformMatrix;

    varying lowp vec4 vColor;

    void main() {
        gl_Position = uTransformMatrix * aVertexPosition;
        vColor = aVertexColor;
    }
`;

const fsSource = `
    varying lowp vec4 vColor;

    void main() {
        gl_FragColor = vColor;
    }
`;

const initApp = () => {
    const gl = setupWebGL('glcanvas');
    if (!gl) return;

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    if (!shaderProgram) return;

    const attribLocations = {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
    };

    const uniformLocations = {
        transformMatrix: gl.getUniformLocation(shaderProgram, 'uTransformMatrix'),
    };

    const letterDefinitions = [
        { ...createLetterK(), baseX: -0.56, phase: 0.0 },
        { ...createLetterD(), baseX:  0.00, phase: 1.4 },
        { ...createLetterO(), baseX:  0.56, phase: 2.8 },
    ];

    const letters = letterDefinitions.map((def) => ({
        baseX: def.baseX,
        phase: def.phase,
        vertexCount: def.vertexCount,
        positionBuffer: createAndBindBuffer(gl, def.positions),
        colorBuffer: createAndBindBuffer(gl, def.colors),
    }));

    const modeSelect = document.getElementById('modeSelect');
    let currentMode = modeSelect?.value ?? 'animated';

    modeSelect?.addEventListener('change', (e) => {
        currentMode = e.target.value;
    });

    gl.useProgram(shaderProgram);

    const render = (now) => {
        const time = now * 0.001;

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.08, 0.10, 0.16, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (currentMode !== 'background') {
            for (const letter of letters) {
                const isAnimated = currentMode === 'animated';

                const yOffset = isAnimated
                    ? Math.sin(time * 2.2 + letter.phase) * 0.15
                    : 0.0;
                const angle = isAnimated
                    ? Math.sin(time * 1.6 + letter.phase) * 0.28
                    : 0.0;
                const scale = isAnimated
                    ? 1.0 + Math.cos(time * 2.5 + letter.phase) * 0.10
                    : 1.0;

                const translationMatrix = createTranslationMatrix(letter.baseX, yOffset, 0.0);
                const rotationMatrix = createZRotationMatrix(angle);
                const scalingMatrix = createScalingMatrix(scale, scale, 1.0);

                const rotScaleMatrix = multiplyMatrices(rotationMatrix, scalingMatrix);
                const transformMatrix = multiplyMatrices(translationMatrix, rotScaleMatrix);

                gl.uniformMatrix4fv(uniformLocations.transformMatrix, false, transformMatrix);

                bindAttribute(gl, letter.positionBuffer, attribLocations.vertexPosition, 2);
                bindAttribute(gl, letter.colorBuffer, attribLocations.vertexColor, 4);

                gl.drawArrays(gl.TRIANGLES, 0, letter.vertexCount);
            }
        }

        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
};

window.addEventListener('load', initApp);
