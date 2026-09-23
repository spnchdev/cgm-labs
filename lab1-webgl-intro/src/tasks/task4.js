import { setupWebGL, initShaderProgram, createAndBindBuffer, bindAttribute } from '../../../shared/gl-utils.js';
import { createTranslationMatrix } from '../../../shared/math.js';

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

(() => {
    const gl = setupWebGL('glcanvas');
    if (!gl) return;

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    const attribLocations = {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
    };
    
    const uniformLocations = {
        transformMatrix: gl.getUniformLocation(shaderProgram, 'uTransformMatrix'),
    };

    const positions = [
         0.0,   0.0,    // center
         0.0,   0.5,    // top
         0.47,  0.15,   // top right
         0.29, -0.4,    // bottom right
        -0.29, -0.4,    // bottom left
        -0.47,  0.15,   // top left
         0.0,   0.5,    // back to top
    ];

    const positionBuffer = createAndBindBuffer(gl, positions);

    const colors = [
        1.0, 1.0, 1.0, 1.0, // center (white)
        1.0, 0.0, 0.0, 1.0, // top (red)
        0.0, 1.0, 0.0, 1.0, // top right (green)
        0.0, 0.0, 1.0, 1.0, // bottom right (blue)
        1.0, 1.0, 0.0, 1.0, // bottom left (yellow)
        1.0, 0.0, 1.0, 1.0, // top left (magenta)
        1.0, 0.0, 0.0, 1.0, // back to top (red)
    ];

    const colorBuffer = createAndBindBuffer(gl, colors);

    bindAttribute(gl, positionBuffer, attribLocations.vertexPosition, 2);
    bindAttribute(gl, colorBuffer, attribLocations.vertexColor, 4);

    gl.useProgram(shaderProgram);

    let yOffset = 0.0;
    let yDirection = 1;
    let then = 0;

    const render = (now) => {
        now *= 0.001;
        const deltaTime = now - then;
        then = now;
        
        yOffset += deltaTime * 0.5 * yDirection;

        if (yOffset > 0.5) {
            yOffset = 0.5;
            yDirection = -1;
        } else if (yOffset < -0.6) {
            yOffset = -0.6;
            yDirection = 1;
        }

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.2, 0.2, 0.2, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const translationMatrix = createTranslationMatrix(0.0, yOffset, 0.0);
        gl.uniformMatrix4fv(uniformLocations.transformMatrix, false, translationMatrix);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 7);

        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
})();
