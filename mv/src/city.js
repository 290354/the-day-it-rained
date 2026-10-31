import * as THREE from 'three';
import { rng, lerp, GLSL_NOISE, texBokeh } from './lib.js';
import { LIGHTS, GLSL_LIGHTS, setLights, litMaterial } from './lighting.js';

/* ============================================================
   楼体立面材质：窗格 + 亮灯 + 雨水痕
   ============================================================ */
export function facadeMaterial(seed, opts = {}) {
  const { winW = 2.0, winH = 3.4, lit = 0.42, baseCol = [0.045, 0.050, 0.058] } = opts;
  return new THREE.ShaderMaterial({
    uniforms: {
      ...LIGHTS,
      uSeed: { value: seed },
      uWinW: { value: winW },
      uWinH: { value: winH },
      uLit: { value: lit },
      uBase: { value: new THREE.Vector3(...baseCol) },
    },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vP;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0);
        vW = w.xyz; vP = position;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_NOISE}
      ${GLSL_LIGHTS}
      uniform float uSeed, uWinW, uWinH, uLit;
      uniform vec3 uBase;
      varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vP;

      void main(){
        vec3 N = normalize(vN);
        vec2 fc;
        if (abs(N.x) > 0.5) fc = vec2(vP.z, vP.y);
        else if (abs(N.z) > 0.5) fc = vec2(vP.x, vP.y);
        else fc = vec2(vP.x, vP.z);

        vec2 g = fc / vec2(uWinW, uWinH);
        vec2 id = floor(g + uSeed * 13.7);
        vec2 f = fract(g);

        // 窗洞
        float wx = smoothstep(0.16, 0.21, f.x) * (1.0 - smoothstep(0.80, 0.85, f.x));
        float wy = smoothstep(0.20, 0.26, f.y) * (1.0 - smoothstep(0.82, 0.88, f.y));
        float win = wx * wy;

        // 亮灯
        float on = step(1.0 - uLit, hash21(id * 1.31 + uSeed));
        vec3 warm = vec3(1.0, 0.74, 0.42);
        vec3 cool = vec3(0.52, 0.74, 1.0);
        vec3 wc = mix(warm, cool, step(0.72, hash21(id + 5.3 + uSeed)));
        float bright = 0.30 + 0.90 * hash21(id * 2.7 + uSeed);
        // 窗内百叶/人影的横向条带
        float blind = 0.75 + 0.25 * step(0.5, fract(f.y * 9.0 + hash21(id) * 3.0));
        vec3 emis = wc * on * win * bright * 1.05 * blind;

        // 混凝土基色 + 脏污
        float dirt = fbm(fc * 0.35 + uSeed * 7.0);
        vec3 base = uBase * (0.55 + 0.75 * dirt);
        vec3 c = shadePoint(N, vW, base, 0.16, 26.0);
        // 窗框稍亮一点
        c += base * 0.35 * (wx * (1.0 - wy) + wy * (1.0 - wx));
        c += emis;

        gl_FragColor = vec4(applyFog(c, vW), 1.0);
      }`,
  });
}

/* ============================================================
   街道：路面 + 人行道 + 路缘 + 标线 + 井盖
   ============================================================ */
export function buildStreet(opts = {}) {
  const {
    length = 220, roadW = 16, walkW = 5.0, seed = 5,
  } = opts;
  const g = new THREE.Group();
  const rnd = rng(seed);

  // 沥青（湿）
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(roadW, length),
    litMaterial(0x0b0d10, { spec: 0.55, shininess: 18, fog: 0.75 }));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = 0.0;
  g.add(asphalt);

  // 人行道
  for (const s of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(walkW, 0.16, length),
      litMaterial(0x111418, { spec: 0.35, shininess: 24 }));
    walk.position.set(s * (roadW / 2 + walkW / 2), 0.08, 0);
    g.add(walk);
    // 路缘石
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.20, length),
      litMaterial(0x1a1e24, { spec: 0.25, shininess: 30 }));
    curb.position.set(s * (roadW / 2 + 0.12), 0.10, 0);
    g.add(curb);
    // 盲道
    const tact = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, length),
      litMaterial(0x2a2418, { spec: 0.1, shininess: 10 }));
    tact.position.set(s * (roadW / 2 + 1.0), 0.17, 0);
    g.add(tact);
  }

  // 车道虚线
  for (const lane of [-roadW / 6, roadW / 6]) {
    for (let i = 0; i < Math.floor(length / 9); i++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.01, 3.2),
        litMaterial(0x9a9585, { spec: 0.1, shininess: 10 }));
      dash.position.set(lane, 0.012, -length / 2 + i * 9 + rnd() * 0.4);
      g.add(dash);
    }
  }
  // 中线
  const center = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.01, length),
    litMaterial(0x8d8676, { spec: 0.1, shininess: 10 }));
  center.position.set(0, 0.012, 0);
  g.add(center);

  // 井盖
  for (let i = 0; i < 7; i++) {
    const mh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 16),
      litMaterial(0x14171c, { spec: 0.5, shininess: 20 }));
    mh.position.set((rnd() - 0.5) * roadW * 0.8, 0.014, -length / 2 + rnd() * length);
    g.add(mh);
  }

  // 积水（更亮的反射片）
  for (let i = 0; i < 14; i++) {
    const r = 0.8 + rnd() * 2.6;
    const pud = new THREE.Mesh(new THREE.CircleGeometry(r, 14),
      new THREE.MeshBasicMaterial({
        color: 0x0c141c, transparent: true, opacity: 0.85, depthWrite: false,
      }));
    pud.rotation.x = -Math.PI / 2;
    pud.position.set((rnd() - 0.5) * (roadW - 2), 0.016, -length / 2 + rnd() * length);
    g.add(pud);
  }

  return g;
}

/* ============================================================
   沿街建筑
   ============================================================ */
export function buildBlocks(opts = {}) {
  const {
    side = 1, zFrom = 12, zTo = -180, roadW = 16, walkW = 5, seed = 11,
    minW = 8, maxW = 18, minH = 10, maxH = 34, shopRow = true,
  } = opts;
  const rnd = rng(seed);
  const g = new THREE.Group();

  let z = zFrom;
  let i = 0;
  while (z > zTo) {
    const w = lerp(minW, maxW, rnd());
    const h = lerp(minH, maxH, Math.pow(rnd(), 0.8));
    const d = 10 + rnd() * 10;
    const x = side * (roadW / 2 + walkW + d / 2 - 1.2);

    const b = new THREE.Mesh(new THREE.BoxGeometry(d, h, w),
      facadeMaterial(seed + i * 3.7, {
        winW: 2.2 + rnd() * 0.8, winH: 3.0 + rnd() * 0.9,
        lit: 0.28 + rnd() * 0.35,
      }));
    b.position.set(x, h / 2, z - w / 2);
    g.add(b);

    // 屋顶杂物
    const roofMat = litMaterial(0x0a0d12, { spec: 0.2 });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.0, 10), roofMat);
    tank.position.set(x + (rnd() - 0.5) * 2, h + 1.0, z - w / 2 + (rnd() - 0.5) * 3);
    if (rnd() > 0.55) g.add(tank);
    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.6), roofMat);
    ac.position.set(x + (rnd() - 0.5) * 3, h + 0.35, z - w / 2 + (rnd() - 0.5) * 4);
    g.add(ac);
    // 天线
    if (rnd() > 0.7) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.0, 4), roofMat);
      ant.position.set(x + (rnd() - 0.5) * 4, h + 1.5, z - w / 2 + (rnd() - 0.5) * 5);
      g.add(ant);
    }

    // 底层商铺：发光橱窗带
    if (shopRow) {
      const shopH = 3.2;
      const shop = new THREE.Mesh(new THREE.BoxGeometry(0.4, shopH * 0.72, w * 0.82),
        litMaterial(0x1a2430, { spec: 0.5, shininess: 40, emissive: 0x2a3a4a, emissiveAmt: 0.35 }));
      shop.position.set(side * (roadW / 2 + walkW - 1.35), shopH * 0.44, z - w / 2);
      g.add(shop);
      // 雨棚
      const awn = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, w * 0.8),
        litMaterial(0x141a22, { spec: 0.1 }));
      awn.position.set(side * (roadW / 2 + walkW - 2.2), shopH * 0.82, z - w / 2);
      awn.rotation.z = side * 0.06;
      g.add(awn);
    }

    z -= w + 0.6 + rnd() * 1.6;
    i++;
  }
  return g;
}

/* ============================================================
   远景天际线
   ============================================================ */
export function buildSkyline(opts = {}) {
  const { count = 60, dist = 320, spread = 520, seed = 33, color = 0x02040a } = opts;
  const rnd = rng(seed);
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  const winMat = new THREE.PointsMaterial({
    color: 0xffc28a, size: 1.4, sizeAttenuation: true,
    transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const wpos = [];
  for (let i = 0; i < count; i++) {
    const w = 12 + rnd() * 26;
    const h = 20 + rnd() * 70;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 12 + rnd() * 20), mat);
    const x = (rnd() - 0.5) * spread;
    const z = -dist - rnd() * 160;
    b.position.set(x, h / 2 - 2, z);
    g.add(b);
    const n = 6 + Math.floor(rnd() * 14);
    for (let k = 0; k < n; k++) {
      wpos.push(x + (rnd() - 0.5) * w * 0.9, 2 + rnd() * h * 0.85, z + 7);
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wpos), 3));
  g.add(new THREE.Points(wg, winMat));
  return g;
}

/* ============================================================
   架空线（雨天城市的天际细节）
   ============================================================ */
export function buildWires(opts = {}) {
  const { spans = 8, spanLen = 16, y = 6.4, x = 0, sag = 0.7, seed = 71 } = opts;
  const rnd = rng(seed);
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x02040a });
  const pts = [];
  for (let s = 0; s < spans; s++) {
    const z0 = -s * spanLen;
    const z1 = -(s + 1) * spanLen;
    for (let k = 0; k < 3; k++) {
      const px = x + (k - 1) * 0.6;
      const seg = 6;
      for (let i = 0; i < seg; i++) {
        const t0 = i / seg, t1 = (i + 1) / seg;
        const p0 = new THREE.Vector3(px, y - Math.sin(t0 * Math.PI) * sag, lerp(z0, z1, t0));
        const p1 = new THREE.Vector3(px, y - Math.sin(t1 * Math.PI) * sag, lerp(z0, z1, t1));
        const mid = p0.clone().add(p1).multiplyScalar(0.5);
        const len = p0.distanceTo(p1);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 3), mat);
        c.position.copy(mid);
        c.lookAt(p1);
        c.rotateX(Math.PI / 2);
        g.add(c);
      }
    }
  }
  return g;
}
