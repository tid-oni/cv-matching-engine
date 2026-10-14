import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Props {
  intensity?: "full" | "subtle";
}

export default function ParticleBackground({ intensity = "full" }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText =
      "position:fixed;top:0;left:0;pointer-events:none;z-index:1;";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 1000);
    camera.position.z = 60;

    const COUNT = intensity === "full" ? 400 : 160;

    // ── Layer 1: Main particles ──────────────────────────────
    const pPos = new Float32Array(COUNT * 3);
    const pCol = new Float32Array(COUNT * 3);
    const vel  = new Float32Array(COUNT * 2);

    const colors = [
      new THREE.Color("#6366f1"),
      new THREE.Color("#8b5cf6"),
      new THREE.Color("#818cf8"),
      new THREE.Color("#a5b4fc"),
      new THREE.Color("#06b6d4"),
    ];

    for (let i = 0; i < COUNT; i++) {
      pPos[i * 3 + 0] = (Math.random() - 0.5) * 130;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 80;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      vel[i * 2 + 0]  = (Math.random() - 0.5) * 0.028;
      vel[i * 2 + 1]  = (Math.random() - 0.5) * 0.018;
      const c = colors[Math.floor(Math.random() * colors.length)];
      pCol[i * 3]     = c.r;
      pCol[i * 3 + 1] = c.g;
      pCol[i * 3 + 2] = c.b;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("color",    new THREE.BufferAttribute(pCol, 3));

    const pMat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.55,
      transparent: true,
      opacity: intensity === "full" ? 0.75 : 0.45,
      sizeAttenuation: true,
    });

    scene.add(new THREE.Points(pGeo, pMat));

    // ── Layer 2: Bright accent particles ────────────────────
    const BRIGHT = Math.floor(COUNT * 0.12);
    const bPos = new Float32Array(BRIGHT * 3);
    const bVel = new Float32Array(BRIGHT * 2);
    for (let i = 0; i < BRIGHT; i++) {
      bPos[i * 3 + 0] = (Math.random() - 0.5) * 110;
      bPos[i * 3 + 1] = (Math.random() - 0.5) * 70;
      bPos[i * 3 + 2] = (Math.random() - 0.5) * 15;
      bVel[i * 2 + 0] = (Math.random() - 0.5) * 0.015;
      bVel[i * 2 + 1] = (Math.random() - 0.5) * 0.012;
    }
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    const bMat = new THREE.PointsMaterial({
      color: 0xc7d2fe,
      size: 1.2,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(bGeo, bMat));

    // ── Connection Lines ─────────────────────────────────────
    const MAX_LINES = intensity === "full" ? 1000 : 300;
    const lPos = new Float32Array(MAX_LINES * 6);
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute("position", new THREE.BufferAttribute(lPos, 3));
    lGeo.setDrawRange(0, 0);
    const lMat = new THREE.LineBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.07,
    });
    scene.add(new THREE.LineSegments(lGeo, lMat));

    // ── Shooting star ────────────────────────────────────────
    type Star = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number };
    const stars: Star[] = [];
    let starTimer = 0;

    const spawnStar = () => {
      if (intensity !== "full") return;
      const side = Math.random() < 0.5 ? -1 : 1;
      stars.push({
        x: side < 0 ? -65 : 65,
        y: (Math.random() - 0.5) * 60,
        vx: side < 0 ? 1.4 : -1.4,
        vy: (Math.random() - 0.5) * 0.6,
        life: 0,
        maxLife: 55 + Math.random() * 30,
      });
    };

    const sGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(6);
    sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    sGeo.setDrawRange(0, 0);
    const sMat = new THREE.LineBasicMaterial({
      color: 0xe0e7ff,
      transparent: true,
      opacity: 0.9,
    });
    scene.add(new THREE.LineSegments(sGeo, sMat));

    // ── 3D Geometric Objects ─────────────────────────────────
    const objects: THREE.Mesh[] = [];

    const makeWire = (geo: THREE.BufferGeometry, color: number, opacity: number, pos: [number,number,number]) => {
      const mat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      scene.add(mesh);
      objects.push(mesh);
      return mesh;
    };

    const torus = makeWire(
      new THREE.TorusGeometry(8, 0.4, 14, 60),
      0x6366f1, intensity === "full" ? 0.12 : 0.07,
      [34, 18, -28]
    );
    const ico = makeWire(
      new THREE.IcosahedronGeometry(6, 1),
      0x8b5cf6, intensity === "full" ? 0.1 : 0.06,
      [-38, -22, -20]
    );
    const oct = makeWire(
      new THREE.OctahedronGeometry(3.5, 0),
      0x06b6d4, intensity === "full" ? 0.12 : 0.07,
      [-12, 24, -22]
    );
    const dodec = makeWire(
      new THREE.DodecahedronGeometry(5, 0),
      0xa5b4fc, intensity === "full" ? 0.08 : 0.04,
      [22, -26, -18]
    );

    // ── Nebula planes ────────────────────────────────────────
    if (intensity === "full") {
      const nebulaGeo = new THREE.PlaneGeometry(60, 40);
      const nebulaMat = new THREE.MeshBasicMaterial({
        color: 0x4338ca,
        transparent: true,
        opacity: 0.035,
        side: THREE.DoubleSide,
      });
      const nebula1 = new THREE.Mesh(nebulaGeo, nebulaMat);
      nebula1.position.set(20, 10, -50);
      nebula1.rotation.z = 0.3;
      scene.add(nebula1);

      const nebula2Mat = new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
        transparent: true,
        opacity: 0.03,
        side: THREE.DoubleSide,
      });
      const nebula2 = new THREE.Mesh(new THREE.PlaneGeometry(50, 35), nebula2Mat);
      nebula2.position.set(-25, -12, -45);
      nebula2.rotation.z = -0.2;
      scene.add(nebula2);
    }

    // ── Mouse Parallax ───────────────────────────────────────
    let mx = 0, my = 0;
    let targetMx = 0, targetMy = 0;
    const onMouse = (e: MouseEvent) => {
      targetMx = (e.clientX / window.innerWidth - 0.5) * 16;
      targetMy = -(e.clientY / window.innerHeight - 0.5) * 11;
    };
    window.addEventListener("mousemove", onMouse);

    // ── Animation Loop ───────────────────────────────────────
    let raf: number;
    let frame = 0;
    const DIST = 18;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      frame++;

      mx += (targetMx - mx) * 0.04;
      my += (targetMy - my) * 0.04;

      // Move main particles
      for (let i = 0; i < COUNT; i++) {
        pPos[i * 3]     += vel[i * 2];
        pPos[i * 3 + 1] += vel[i * 2 + 1];
        if (pPos[i * 3]     >  65) pPos[i * 3]     = -65;
        if (pPos[i * 3]     < -65) pPos[i * 3]     =  65;
        if (pPos[i * 3 + 1] >  40) pPos[i * 3 + 1] = -40;
        if (pPos[i * 3 + 1] < -40) pPos[i * 3 + 1] =  40;
      }
      pGeo.attributes.position.needsUpdate = true;

      // Move bright particles
      for (let i = 0; i < BRIGHT; i++) {
        bPos[i * 3]     += bVel[i * 2];
        bPos[i * 3 + 1] += bVel[i * 2 + 1];
        if (bPos[i * 3]     >  55) bPos[i * 3]     = -55;
        if (bPos[i * 3]     < -55) bPos[i * 3]     =  55;
        if (bPos[i * 3 + 1] >  35) bPos[i * 3 + 1] = -35;
        if (bPos[i * 3 + 1] < -35) bPos[i * 3 + 1] =  35;
      }
      bGeo.attributes.position.needsUpdate = true;

      // Connection lines
      let lc = 0;
      for (let i = 0; i < COUNT && lc < MAX_LINES; i++) {
        for (let j = i + 1; j < COUNT && lc < MAX_LINES; j++) {
          const dx = pPos[i * 3] - pPos[j * 3];
          const dy = pPos[i * 3 + 1] - pPos[j * 3 + 1];
          if (dx * dx + dy * dy < DIST * DIST) {
            const b = lc * 6;
            lPos[b]     = pPos[i * 3];
            lPos[b + 1] = pPos[i * 3 + 1];
            lPos[b + 2] = pPos[i * 3 + 2];
            lPos[b + 3] = pPos[j * 3];
            lPos[b + 4] = pPos[j * 3 + 1];
            lPos[b + 5] = pPos[j * 3 + 2];
            lc++;
          }
        }
      }
      lGeo.attributes.position.needsUpdate = true;
      lGeo.setDrawRange(0, lc * 2);

      // Shooting stars
      if (intensity === "full") {
        starTimer++;
        if (starTimer > 200 && Math.random() < 0.012) {
          spawnStar();
          starTimer = 0;
        }

        if (stars.length > 0) {
          const s = stars[0];
          s.x += s.vx;
          s.y += s.vy;
          s.life++;

          const fade = 1 - s.life / s.maxLife;
          sMat.opacity = fade * 0.95;

          const trailLen = 6;
          sPos[0] = s.x - s.vx * trailLen;
          sPos[1] = s.y - s.vy * trailLen;
          sPos[2] = 0;
          sPos[3] = s.x;
          sPos[4] = s.y;
          sPos[5] = 0;
          sGeo.attributes.position.needsUpdate = true;
          sGeo.setDrawRange(0, 2);

          if (s.life >= s.maxLife) {
            stars.shift();
            sGeo.setDrawRange(0, 0);
          }
        }
      }

      // Rotate objects
      torus.rotation.x  += 0.003;
      torus.rotation.y  += 0.005;
      ico.rotation.x    += 0.002;
      ico.rotation.z    += 0.003;
      oct.rotation.y    += 0.006;
      oct.rotation.x    += 0.003;
      dodec.rotation.x  -= 0.002;
      dodec.rotation.y  += 0.004;

      // Subtle breathing on bright particles
      bMat.opacity = 0.5 + 0.15 * Math.sin(frame * 0.02);

      // Camera parallax
      camera.position.x += (mx - camera.position.x) * 0.03;
      camera.position.y += (my - camera.position.y) * 0.03;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [intensity]);

  return <div ref={mountRef} />;
}
