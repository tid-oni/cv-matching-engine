import { useEffect, useRef } from "react";
import * as THREE from "three";

export function WebGLShader() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animationId = 0;

    try {
      const vertexShader = `
        attribute vec3 position;
        void main() { gl_Position = vec4(position, 1.0); }
      `;
      const fragmentShader = `
        precision highp float;
        uniform vec2 resolution;
        uniform float time;
        uniform float xScale;
        uniform float yScale;
        uniform float distortion;
        void main() {
          vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
          float d = length(p) * distortion;
          float rx = p.x * (1.0 + d);
          float gx = p.x;
          float bx = p.x * (1.0 - d);
          float r = 0.05 / abs(p.y + sin((rx + time) * xScale) * yScale);
          float g = 0.05 / abs(p.y + sin((gx + time) * xScale) * yScale);
          float b = 0.05 / abs(p.y + sin((bx + time) * xScale) * yScale);
          gl_FragColor = vec4(r, g, b, 1.0);
        }
      `;

      const scene = new THREE.Scene();
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x000000);
      container.appendChild(renderer.domElement);

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1);

      const uniforms = {
        resolution: { value: [container.clientWidth, container.clientHeight] as [number, number] },
        time:       { value: 0.0 },
        xScale:     { value: 1.0 },
        yScale:     { value: 0.5 },
        distortion: { value: 0.05 },
      };

      const positions = new THREE.BufferAttribute(
        new Float32Array([-1,-1,0, 1,-1,0, -1,1,0, 1,-1,0, -1,1,0, 1,1,0]), 3
      );
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", positions);

      const material = new THREE.RawShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: uniforms as Record<string, THREE.IUniform>,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const handleResize = () => {
        if (!renderer || !container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h, false);
        (uniforms.resolution.value as unknown as number[]) = [w, h];
      };
      handleResize();
      window.addEventListener("resize", handleResize);

      const animate = () => {
        animationId = requestAnimationFrame(animate);
        (uniforms.time.value as number) += 0.01;
        if (renderer) renderer.render(scene, camera);
      };
      animate();

      return () => {
        cancelAnimationFrame(animationId);
        window.removeEventListener("resize", handleResize);
        scene.remove(mesh);
        geometry.dispose();
        material.dispose();
        if (renderer) {
          renderer.dispose();
          renderer.domElement.remove();
          renderer = null;
        }
      };
    } catch (_e) {
      // WebGL context unavailable — fail silently, background degrades gracefully
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: "hidden" }}
    />
  );
}