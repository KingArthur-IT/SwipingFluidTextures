/*
    Copyright (c) 2021 Artem Ostapenko
*/
class GLProgram {
    constructor(contex, vertexShader, fragmentShader) {
        this.gl = contex;
        this.uniforms = {};
        this.program = this.gl.createProgram();

        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);
        
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            throw this.gl.getProgramInfoLog(this.program);
        }

        const uniformCount = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
            const uniformName = this.gl.getActiveUniform(this.program, i).name;
            this.uniforms[uniformName] = this.gl.getUniformLocation(this.program, uniformName);
        }
    }

    use() {
        this.gl.useProgram(this.program);
    }
}
class Shaders{
    constructor(contex) {
        this.gl = contex;
        let vertexShader        = this.compileShader(this.gl.VERTEX_SHADER,  this.vertexShaderCode);
        let displayShader       = this.compileShader(this.gl.FRAGMENT_SHADER,this.displayShaderCode);
        let spotShader          = this.compileShader(this.gl.FRAGMENT_SHADER,this.spotShaderCode);
        let advectionShader     = this.compileShader(this.gl.FRAGMENT_SHADER,this.advectionShaderCode);
        let divergenceShader    = this.compileShader(this.gl.FRAGMENT_SHADER,this.divergenceShaderCode);
        let pressureShader      = this.compileShader(this.gl.FRAGMENT_SHADER,this.pressureShaderCode);
        let gradientShader      = this.compileShader(this.gl.FRAGMENT_SHADER,this.gradientShaderCode);

        this.displayProgram     = new GLProgram(this.gl, vertexShader, displayShader);
        this.spotProgram        = new GLProgram(this.gl, vertexShader, spotShader);
        this.advectionProgram   = new GLProgram(this.gl, vertexShader, advectionShader);
        this.divergenceProgram  = new GLProgram(this.gl, vertexShader, divergenceShader);
        this.pressureProgram    = new GLProgram(this.gl, vertexShader, pressureShader);
        this.gradientProgram    = new GLProgram(this.gl, vertexShader, gradientShader);
    }
    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw this.gl.getShaderInfoLog(shader);
        }

        return shader;
    };
    //Shader codes
    get vertexShaderCode() {
        let vertexShaderCode = `
            precision mediump float;

            attribute vec2 aPosition;
            varying vec2 vUv;
            varying vec2 vL;
            varying vec2 vR;
            varying vec2 vT;
            varying vec2 vB;
            uniform vec2 texelSize;

            void main () {
                vUv = aPosition * 0.5 + 0.5;
                vL = vUv - vec2(texelSize.x, 0.0);
                vR = vUv + vec2(texelSize.x, 0.0);
                vT = vUv + vec2(0.0, texelSize.y);
                vB = vUv - vec2(0.0, texelSize.y);
                gl_Position = vec4(aPosition, 0.0, 1.0);
            }
        `;
        return vertexShaderCode;
    }
    get displayShaderCode() {
        let displayShader = `
            precision mediump float;

            varying vec2 vUv;

            uniform sampler2D uTexture;

            void main () {
                gl_FragColor = texture2D(uTexture, vUv);
            }
        `;
        return displayShader;
    }
    get spotShaderCode() {
         let spotCode = `
            precision mediump float;

            varying vec2 vUv;
            uniform sampler2D uTarget;
            uniform float aspectRatio;
            uniform vec3 color;
            uniform vec2 point;
            uniform float radius;

            void main () {
                vec2 p = vUv - point.xy;
                p.x *= aspectRatio;
                vec3 splat = exp(-dot(p, p) / radius) * color;
                vec3 base = texture2D(uTarget, vUv).xyz;
                gl_FragColor = vec4(base + splat, 1.0);
            }
        `;
        return spotCode;
    }
    get advectionShaderCode() {
        const advectionCode = `
            precision mediump float;

            varying vec2 vUv;
            uniform sampler2D uVelocity;
            uniform sampler2D uSource;
            uniform vec2 texelSize;
            uniform float dt;
            uniform float dissipation;

            void main () {
                vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
                gl_FragColor = dissipation * texture2D(uSource, coord);
            }
        `;
        return advectionCode;
    }
    get divergenceShaderCode() {
        let divergenceCode = `
            precision mediump float;

            varying vec2 vUv;
            varying vec2 vL;
            varying vec2 vR;
            varying vec2 vT;
            varying vec2 vB;
            uniform sampler2D uVelocity;

            vec2 sampleVelocity (in vec2 uv) {
                vec2 multiplier = vec2(1.0, 1.0);
                if (uv.x < 0.0) { uv.x = 0.0; multiplier.x = -1.0; }
                if (uv.x > 1.0) { uv.x = 1.0; multiplier.x = -1.0; }
                if (uv.y < 0.0) { uv.y = 0.0; multiplier.y = -1.0; }
                if (uv.y > 1.0) { uv.y = 1.0; multiplier.y = -1.0; }
                return multiplier * texture2D(uVelocity, uv).xy;
            }

            void main () {
                float L = sampleVelocity(vL).x;
                float R = sampleVelocity(vR).x;
                float T = sampleVelocity(vT).y;
                float B = sampleVelocity(vB).y;
                float div = 0.5 * (R - L + T - B);
                gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
            }
        `;
        return divergenceCode;
    }
    get pressureShaderCode() {
        let pressureCode = `
            precision mediump float;

            varying vec2 vUv;
            varying vec2 vL;
            varying vec2 vR;
            varying vec2 vT;
            varying vec2 vB;
            uniform sampler2D uPressure;
            uniform sampler2D uDivergence;

            vec2 boundary (in vec2 uv) {
                uv = min(max(uv, 0.0), 1.0);
                return uv;
            }

            void main () {
                float L = texture2D(uPressure, boundary(vL)).x;
                float R = texture2D(uPressure, boundary(vR)).x;
                float T = texture2D(uPressure, boundary(vT)).x;
                float B = texture2D(uPressure, boundary(vB)).x;
                float C = texture2D(uPressure, vUv).x;
                float divergence = texture2D(uDivergence, vUv).x;
                float pressure = (L + R + B + T - divergence) * 0.25;
                gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
            }
        `;
        return pressureCode;
    }
    get gradientShaderCode() {
        const gradientShaderCode = `
            precision mediump float;

            varying vec2 vUv;
            varying vec2 vL;
            varying vec2 vR;
            varying vec2 vT;
            varying vec2 vB;
            uniform sampler2D uPressure;
            uniform sampler2D uVelocity;

            vec2 boundary (in vec2 uv) {
                uv = min(max(uv, 0.0), 1.0);
                return uv;
            }

            void main () {
                float L = texture2D(uPressure, boundary(vL)).x;
                float R = texture2D(uPressure, boundary(vR)).x;
                float T = texture2D(uPressure, boundary(vT)).x;
                float B = texture2D(uPressure, boundary(vB)).x;
                vec2 velocity = texture2D(uVelocity, vUv).xy;
                velocity.xy -= vec2(R - L, T - B);
                gl_FragColor = vec4(velocity, 0.0, 1.0);
            }
        `;
        return gradientShaderCode;
    }
}
//self-calling function
(function () {
    let canvas = document.getElementById('canvas');
    const gl = canvas.getContext('webgl', { alpha: false, preserveDrawingBuffer: false, depth: false, stencil: false });

    const halfFloat = gl.getExtension('OES_texture_half_float');
    const support_linear_float = gl.getExtension('OES_texture_half_float_linear');

    resizeCanvas();

    const TEXTURE_DOWNSAMPLE = 2;
    const TEXTURE_WIDTH = gl.drawingBufferWidth >> TEXTURE_DOWNSAMPLE;
    const TEXTURE_HEIGHT = gl.drawingBufferHeight >> TEXTURE_DOWNSAMPLE;
    const VELOCITY_DISSIPATION = 0.99;
    const SPOT_RADIUS = 0.003;

    let texId = -1;

    function display(target) {
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function clear (target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    
    function createFBO (width, height, format, type, param) {
        texId++;
        gl.activeTexture(gl.TEXTURE0 + texId);
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, null);

        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, width, height);

        return [texture, fbo, texId];
    }

    function createDoubleFBO (width, height, format, type, param) {
        let fbo1 = createFBO(width, height, format, type, param);
        let fbo2 = createFBO(width, height, format, type, param);

        return {
            get first () {
                return fbo1;
            },
            get second () {
                return fbo2;
            },
            swap: () => {
                let temp = fbo1;
                fbo1 = fbo2;
                fbo2 = temp;
            }
        }
    }

    let density    = createDoubleFBO(TEXTURE_WIDTH, TEXTURE_HEIGHT, gl.RGBA, halfFloat.HALF_FLOAT_OES, support_linear_float ? gl.LINEAR : gl.NEAREST);
    let velocity   = createDoubleFBO(TEXTURE_WIDTH, TEXTURE_HEIGHT, gl.RGBA, halfFloat.HALF_FLOAT_OES, support_linear_float ? gl.LINEAR : gl.NEAREST);
    let divergence = createFBO      (TEXTURE_WIDTH, TEXTURE_HEIGHT, gl.RGBA, halfFloat.HALF_FLOAT_OES, gl.NEAREST);
    let pressure   = createDoubleFBO(TEXTURE_WIDTH, TEXTURE_HEIGHT, gl.RGBA, halfFloat.HALF_FLOAT_OES, gl.NEAREST);

    let shaders = new Shaders(gl);

    let pointer = {
        x: 0,
        y: 0,
        deltax: 0,
        deltay: 0,
        down: false,
        moved: false,
        color: [0, 0, 0]
    }

    Update();

    function Update () {
        resizeCanvas();

        gl.viewport(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

        shaders.advectionProgram.use();
        gl.uniform2f(shaders.advectionProgram.uniforms.texelSize, 1.0 / TEXTURE_WIDTH, 1.0 / TEXTURE_HEIGHT);
        gl.uniform1i(shaders.advectionProgram.uniforms.uVelocity, velocity.first[2]);
        gl.uniform1i(shaders.advectionProgram.uniforms.uSource, velocity.first[2]);
        gl.uniform1f(shaders.advectionProgram.uniforms.dt, 0.016);
        gl.uniform1f(shaders.advectionProgram.uniforms.dissipation, VELOCITY_DISSIPATION);
        display(velocity.second[1]);
        velocity.swap();

        gl.uniform1i(shaders.advectionProgram.uniforms.uVelocity, velocity.first[2]);
        gl.uniform1i(shaders.advectionProgram.uniforms.uSource, density.first[2]);
        display(density.second[1]);
        density.swap();

        if (pointer.moved)
        {
            shaders.spotProgram.use();
            gl.uniform1i(shaders.spotProgram.uniforms.uTarget, velocity.first[2]);
            gl.uniform1f(shaders.spotProgram.uniforms.aspectRatio, TEXTURE_WIDTH / TEXTURE_HEIGHT);
            gl.uniform2f(shaders.spotProgram.uniforms.point, pointer.x / canvas.width, 1.0 - pointer.y / canvas.height);
            gl.uniform3f(shaders.spotProgram.uniforms.color, pointer.deltax, -pointer.deltay, 1.0); //интересный эффект с "-"
            gl.uniform1f(shaders.spotProgram.uniforms.radius, SPOT_RADIUS);
            display(velocity.second[1]);
            velocity.swap();

            gl.uniform1i(shaders.spotProgram.uniforms.uTarget, density.first[2]);
            gl.uniform3f(shaders.spotProgram.uniforms.color, pointer.color[0], pointer.color[1], pointer.color[2]);
            display(density.second[1]);
            density.swap();
        }
        
        shaders.divergenceProgram.use();
        gl.uniform2f(shaders.divergenceProgram.uniforms.texelSize, 1.0 / TEXTURE_WIDTH, 1.0 / TEXTURE_HEIGHT);
        gl.uniform1i(shaders.divergenceProgram.uniforms.uVelocity, velocity.first[2]);
        display(divergence[1]);

        clear(pressure.first[1]); //fluid effect
        shaders.pressureProgram.use();
        gl.uniform2f(shaders.pressureProgram.uniforms.texelSize, 1.0 / TEXTURE_WIDTH, 1.0 / TEXTURE_HEIGHT);
        gl.uniform1i(shaders.pressureProgram.uniforms.uDivergence, divergence[2]);
        for (let i = 0; i < 50; i++) {
            gl.uniform1i(shaders.pressureProgram.uniforms.uPressure, pressure.first[2]);
            display(pressure.second[1]);
            pressure.swap();
        }

        shaders.gradientProgram.use();
        gl.uniform2f(shaders.gradientProgram.uniforms.texelSize, 1.0 / TEXTURE_WIDTH, 1.0 / TEXTURE_HEIGHT);
        gl.uniform1i(shaders.gradientProgram.uniforms.uPressure, pressure.first[2]);
        gl.uniform1i(shaders.gradientProgram.uniforms.uVelocity, velocity.first[2]);
        display(velocity.second[1]);
        velocity.swap();

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        shaders.displayProgram.use();
        gl.uniform1i(shaders.displayProgram.uniforms.uTexture, density.first[2]);
        display(null);

        pointer.moved = false;

        requestAnimationFrame(Update);
    }   

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('touchstart', onPointerDown);

    canvas.addEventListener('mousemove', (e) => {
        pointer.moved = pointer.down;
        pointer.deltax = clampDelta(e.offsetX - pointer.x);
        pointer.deltay = clampDelta(e.offsetY - pointer.y);
        pointer.x = e.offsetX;
        pointer.y = e.offsetY;
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        let x = touch.pageX;
        let y = touch.pageY;
        
        pointer.moved = pointer.down;
        pointer.deltax = clampDelta(x - pointer.x);
        pointer.deltay = clampDelta(y - pointer.y);
        pointer.x = x;
        pointer.y = y;        
    });

    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);

    function onPointerDown () {
        pointer.down = true;
        pointer.color = [Math.random(), Math.random(), Math.random()];
    }
    function onPointerUp () {
        pointer.down = false;
    } 
}())

function resizeCanvas() {
        canvas.width  = innerWidth;
        canvas.height = innerHeight;
}
function clampDelta (delta) {
        return delta * 10;
}