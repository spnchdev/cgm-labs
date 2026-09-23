export const setupWebGL = (canvasId) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    if (!gl) {
        alert('Unable to initialize WebGL.');
        return null;
    }

    return gl;
};

export const compileShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`);
        gl.deleteShader(shader);
        return null;
    }

    return shader;
};

export const createProgram = (gl, vertexShader, fragmentShader) => {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(`Unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`);
        return null;
    }

    return program;
};

export const initShaderProgram = (gl, vsSource, fsSource) => {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    return createProgram(gl, vertexShader, fragmentShader);
};

export const createAndBindBuffer = (gl, data) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return buffer;
};

export const bindAttribute = (gl, buffer, attributeLocation, numComponents) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(
        attributeLocation,
        numComponents,
        gl.FLOAT,
        false,
        0,
        0);
    gl.enableVertexAttribArray(attributeLocation);
};
