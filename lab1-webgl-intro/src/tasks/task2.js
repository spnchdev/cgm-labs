import { setupWebGL, initShaderProgram, createAndBindBuffer, bindAttribute } from '../../../shared/gl-utils.js';

const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;
    varying lowp vec4 vColor;
    
    void main() {
        gl_Position = aVertexPosition;
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

    const positionBuffer = createAndBindBuffer(gl, [
         0.0,  0.5,
        -0.5, -0.5,
         0.5, -0.5,
    ]);

    const colorBuffer = createAndBindBuffer(gl, [
        1.0, 0.0, 0.0, 1.0, 
        0.0, 1.0, 0.0, 1.0, 
        0.0, 0.0, 1.0, 1.0, 
    ]);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.2, 0.2, 0.2, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(shaderProgram);

    bindAttribute(gl, positionBuffer, attribLocations.vertexPosition, 2);
    bindAttribute(gl, colorBuffer, attribLocations.vertexColor, 4);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
})();
