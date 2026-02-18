import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';
import './Silk.css';

const VERT = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;

varying vec2 vUv;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2 r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2 rot = mat2(c, -s, s, c);
  return rot * uv;
}

void main() {
  float rnd = noise(gl_FragCoord.xy);
  vec2 uv = rotateUvs(vUv * uScale, uRotation);
  vec2 tex = uv * uScale;
  float tOffset = uSpeed * uTime;

  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

  float pattern = 0.6 +
                  0.4 * sin(5.0 * (tex.x + tex.y +
                                   cos(3.0 * tex.x + 5.0 * tex.y) +
                                   0.02 * tOffset) +
                           sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));
                           
  vec3 color = uColor * pattern - vec3(rnd / 15.0 * uNoiseIntensity);
  gl_FragColor = vec4(color, 1.0);
}
`;

export interface SilkProps {
    speed?: number;
    scale?: number;
    color?: string;
    noiseIntensity?: number;
    rotation?: number;
}

export default function Silk({
    speed = 0.25,
    scale = 0.75,
    color = '#7B7481',
    noiseIntensity = 0.5,
    rotation = 2
}: SilkProps) {
    const ctnDom = useRef<HTMLDivElement>(null);
    const propsRef = useRef({ speed, scale, color, noiseIntensity, rotation });

    // Update refs when props change
    useEffect(() => {
        propsRef.current = { speed, scale, color, noiseIntensity, rotation };
    }, [speed, scale, color, noiseIntensity, rotation]);

    useEffect(() => {
        const ctn = ctnDom.current;
        if (!ctn) return;

        const renderer = new Renderer({
            alpha: true,
            premultipliedAlpha: false,
            antialias: true,
            dpr: Math.min(window.devicePixelRatio, 2)
        });
        const gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);

        const geometry = new Triangle(gl);

        const program = new Program(gl, {
            vertex: VERT,
            fragment: FRAG,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new Color(color) },
                uSpeed: { value: speed },
                uScale: { value: scale },
                uRotation: { value: rotation },
                uNoiseIntensity: { value: noiseIntensity }
            }
        });

        const mesh = new Mesh(gl, { geometry, program });

        function resize() {
            if (!ctn) return;
            renderer.setSize(ctn.offsetWidth, ctn.offsetHeight);
        }
        window.addEventListener('resize', resize);
        resize();

        ctn.appendChild(gl.canvas);

        let animateId = 0;
        const update = (t: number) => {
            animateId = requestAnimationFrame(update);

            const time = t * 0.001;
            const p = propsRef.current;

            program.uniforms.uTime.value = time;
            program.uniforms.uSpeed.value = p.speed;
            program.uniforms.uScale.value = p.scale;
            program.uniforms.uRotation.value = p.rotation;
            program.uniforms.uNoiseIntensity.value = p.noiseIntensity;
            program.uniforms.uColor.value = new Color(p.color);

            renderer.render({ scene: mesh });
        };
        animateId = requestAnimationFrame(update);

        return () => {
            cancelAnimationFrame(animateId);
            window.removeEventListener('resize', resize);
            if (ctn && gl.canvas.parentNode === ctn) {
                ctn.removeChild(gl.canvas);
            }
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        };
    }, []); // Re-init if drastic changes, but mostly we rely on refs for updates

    return <div ref={ctnDom} className="silk-container" />;
}
