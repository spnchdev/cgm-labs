import { setupWebGL } from '../../../shared/gl-utils.js';

(() => {
    const gl = setupWebGL('glcanvas');
    if (!gl) return;

    const canvas = gl.canvas;
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearColor(0.392, 0.584, 0.929, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
})();
