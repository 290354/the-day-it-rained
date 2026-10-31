import * as THREE from 'three';

/* ---------------------------------------------------------------- utils */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;

/* ---------------------------------------------------------------- glsl */
export const GLSL_NOISE = /* glsl */`
float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash21(i), b = hash21(i+vec2(1.,0.)), c = hash21(i+vec2(0.,1.)), d = hash21(i+vec2(1.,1.));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + 17.7; a *= 0.5; }
  return s;
}
`;

export const GLSL_SKY = /* glsl */`
vec3 skyNight(vec3 c){
  // 青黑 -> 钠灯地平线
  float h = clamp(c.y*0.5+0.5, 0.0, 1.0);
  vec3 top = vec3(0.012,0.021,0.035);
  vec3 mid = vec3(0.035,0.062,0.098);
  vec3 low = vec3(0.165,0.115,0.078);
  vec3 col = mix(low, mid, smoothstep(0.40,0.62,h));
  col = mix(col, top, smoothstep(0.60,1.0,h));
  return col;
}
`;

/* ---------------------------------------------------------- textures */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** 圆形散景光斑（模拟失焦灯光） */
export const texBokeh = () => canvasTex(128, 128, (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.72)');
  grd.addColorStop(0.72, 'rgba(255,255,255,0.16)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});

/** 柔和体积光锥渐变（竖直） */
export const texGlow = () => canvasTex(64, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

/** 星点 / 尘埃 */
export const texDust = () => canvasTex(64, 64, (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});

/* ---------------------------------------------------------- lights */
/** 生成一组散景光点（远景灯光），additive sprite 群 */
export function bokehField(count, box, rnd, colorFn, sizeRange = [0.4, 1.6]) {
  const tex = texBokeh();
  const geo = new THREE.PlaneGeometry(1, 1);
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const m = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0.28 + rnd() * 0.6,
      color: colorFn(rnd),
    });
    const s = lerp(sizeRange[0], sizeRange[1], Math.pow(rnd(), 2.2));
    const mesh = new THREE.Mesh(geo, m);
    mesh.scale.set(s, s, 1);
    mesh.position.set(
      (rnd() - 0.5) * box[0],
      (rnd() - 0.15) * box[1],
      -rnd() * box[2],
    );
    mesh.userData.phase = rnd() * 6.28;
    group.add(mesh);
  }
  return group;
}

/* ---------------------------------------------------------- rain */
/**
 * 雨：实例化的细长光条，vertex shader 位移，支持“倒流”。
 * dir = -1 正常下落 / +1 反向上升
 */
export function createRain(opts = {}) {
  const {
    count = 4200, area = [60, 34, 90], len = [0.9, 2.6],
    speed = [11, 20], width = 0.016, color = 0xbcd8ff, opacity = 0.5,
    dir = -1, seed = 7, wind = 0.14,
  } = opts;

  const rnd = rng(seed);
  const g = new THREE.InstancedBufferGeometry();
  // 单位细条：沿 y 从 0..1，宽 ±0.5
  const pos = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]);
  const idx = [0, 1, 2, 0, 2, 3];
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);

  const aOff = new Float32Array(count * 3);
  const aPar = new Float32Array(count * 3); // len, speed, phase
  for (let i = 0; i < count; i++) {
    aOff[i * 3 + 0] = (rnd() - 0.5) * area[0];
    aOff[i * 3 + 1] = rnd() * area[1];
    aOff[i * 3 + 2] = (rnd() - 0.5) * area[2];
    aPar[i * 3 + 0] = lerp(len[0], len[1], rnd());
    aPar[i * 3 + 1] = lerp(speed[0], speed[1], rnd());
    aPar[i * 3 + 2] = rnd() * 100.0;
  }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 3));
  g.setAttribute('aPar', new THREE.InstancedBufferAttribute(aPar, 3));
  g.instanceCount = count;

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uDir: { value: dir }, uH: { value: area[1] },
      uW: { value: width }, uOpacity: { value: opacity }, uWind: { value: wind },
      uColor: { value: new THREE.Color(color) }, uSlant: { value: 0.09 },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */`
      attribute vec3 aOff; attribute vec3 aPar;
      uniform float uTime, uDir, uH, uW, uWind, uSlant;
      varying float vA; varying vec2 vUv;
      void main(){
        vec3 p = aOff;
        // 循环下落(uDir=-1) / 上升(uDir=+1)
        p.y = mod(p.y + uTime * aPar.y * uDir, uH);
        p.x += uWind * p.y * uSlant;
        p.z += uWind * p.y * 0.05;
        vec3 toCam = cameraPosition - p;
        float d = length(toCam);
        // billboard：面向相机，按运动反方向拉伸
        float sgn = uDir > 0.0 ? -1.0 : 1.0;
        vec3 up = normalize(vec3(uSlant * uWind, sgn, 0.04));
        vec3 right = normalize(cross(up, normalize(toCam)));
        float L = aPar.x;
        vec3 world = p + up * (position.y * L) + right * (position.x * uW * (1.0 + d * 0.03));
        vA = smoothstep(0.0, 1.0, position.y) * (0.55 + 0.45 * sin(aPar.z + uTime * 2.0));
        float fade = 1.0 - smoothstep(uH * 0.55, uH, p.y);
        vA *= fade;
        vUv = position.xy;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        gl_Position.z += 0.0002 * d;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity;
      varying float vA; varying vec2 vUv;
      void main(){
        float edge = smoothstep(0.0, 0.45, vUv.x) * smoothstep(1.0, 0.55, vUv.x);
        float head = pow(vUv.y, 1.6);
        float a = vA * uOpacity * edge * (0.25 + head);
        gl_FragColor = vec4(uColor * (0.7 + 0.9 * head), a);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.userData.mat = mat;
  mesh.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return mesh;
}

/* ---------------------------------------------------------- 湿地反光地面 */
export function createWetGround(opts = {}) {
  const {
    size = [80, 120], color = 0x070c12, ripple = 1.0, refl = 1.0, seed = 3,
    glowColor = new THREE.Color(0xff9b45), intensity = 1.0,
  } = opts;
  const mat = new THREE.ShaderMaterial({
    transparent: false,
    uniforms: {
      uTime: { value: 0 }, uColor: { value: new THREE.Color(color) },
      uRipple: { value: ripple }, uRefl: { value: refl }, uSeed: { value: seed },
      uGlow: { value: glowColor }, uI: { value: intensity },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      uniform float uTime, uRipple, uRefl, uSeed, uI;
      uniform vec3 uColor, uGlow;
      varying vec3 vW;
      void main(){
        vec2 p = vW.xz;
        float d1 = length(vW - cameraPosition);
        // 细密水波
        float w = 0.0;
        for(int i=1;i<4;i++){
          float fi = float(i);
          w += sin(p.x*fi*2.7 + uTime*1.6*fi + sin(p.y*1.3+uTime*0.7)) * 0.5;
          w += sin(p.y*fi*3.1 - uTime*1.2*fi) * 0.5;
        }
        // 雨点涟漪（环）
        vec2 cell = floor(p*2.6);
        vec2 f = fract(p*2.6);
        float rr = 0.0;
        for(int k=0;k<2;k++){
          vec2 cc = vec2(hash21(cell+vec2(float(k)*7.3,uSeed)), hash21(cell+vec2(uSeed,float(k)*3.1)));
          float t = fract(uTime*0.75 + hash21(cell+float(k)*11.0));
          float rad = t*0.40;
          float ring = smoothstep(0.055,0.0, abs(length(f-cc)-rad)) * pow(1.0-t, 2.0);
          rr += ring;
        }
        float spec = pow(max(0.0, sin(w*0.6 + rr*3.0)), 6.0);
        // 竖向拉长的灯影
        float lane = smoothstep(0.62,1.0, sin(p.x*0.55 + sin(p.x*0.13)*2.0)*0.5+0.5);
        vec3 col = uColor;
        col += uGlow * (0.018 + spec*0.50*uRefl) * lane * uI;
        col += vec3(0.35,0.55,0.85) * spec * 0.16 * uRefl;
        col += uGlow * rr * 0.35 * uRipple;
        // 远处压暗
        col *= 1.0 - smoothstep(14.0, 55.0, d1)*0.85;
        // 近处提亮一点点细节
        col += vec3(0.02,0.03,0.045) * smoothstep(9.0,0.0,d1);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const geo = new THREE.PlaneGeometry(size[0], size[1], 1, 1);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return m;
}

/* ---------------------------------------------------------- 雨点溅射 */
export function createSplashes(opts = {}) {
  const { count = 1100, area = [40, 34], color = 0xbcd8ff, speed = 1.9, seed = 9, h = [0.05, 0.20] } = opts;
  const rnd = rng(seed);
  const pos = new Float32Array(count * 3);
  const par = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * area[0];
    pos[i * 3 + 1] = 0.012;
    pos[i * 3 + 2] = (rnd() - 0.5) * area[1] - 5;
    par[i * 2] = rnd();
    par[i * 2 + 1] = lerp(h[0], h[1], Math.pow(rnd(), 1.8));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPar', new THREE.BufferAttribute(par, 2));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uSpeed: { value: speed },
      uC: { value: new THREE.Color(color) }, uO: { value: 0.20 },
    },
    vertexShader: `attribute vec2 aPar; uniform float uTime, uSpeed;
      varying float vA;
      void main(){
        float t = fract(uTime * uSpeed * (0.65 + fract(aPar.x*7.3)) + aPar.x);
        vec3 p = position;
        p.y += sin(t * 3.14159) * aPar.y;
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = clamp(26.0 / max(d, 0.001), 0.8, 5.0);
        vA = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.55, 1.0, t));
        vA *= smoothstep(38.0, 4.0, d);
      }`,
    fragmentShader: `uniform vec3 uC; uniform float uO; varying float vA;
      void main(){ vec2 q = gl_PointCoord - 0.5;
        gl_FragColor = vec4(uC, smoothstep(0.5, 0.02, length(q)) * vA * uO); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return pts;
}

/* ---------------------------------------------------------- 剪影人形 */
export function createFigure(opts = {}) {
  const { height = 1.72, color = 0x02030a, umbrella = false, umbColor = 0x05070d } = opts;
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color(color) },
      uRim: { value: new THREE.Color(0xffb173) },
      uRimAmt: { value: 0.42 },
      uL: { value: new THREE.Vector3(-0.25, 0.85, -1.0).normalize() },
    },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0);
        vN = normalize(mat3(modelMatrix)*normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCol,uRim,uL; uniform float uRimAmt;
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 N = normalize(vN);
        float f = 1.0 - abs(dot(N, normalize(vV)));
        float lam = clamp(dot(N, normalize(uL)), 0.0, 1.0);
        float rim = pow(f, 3.2) * pow(lam, 1.6);
        vec3 c = uCol + uRim * rim * uRimAmt;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const H = height;
  // 腿
  const leg = new THREE.CylinderGeometry(0.075, 0.055, H * 0.46, 6);
  const l1 = new THREE.Mesh(leg, mat); l1.position.set(-0.075, H * 0.23, 0);
  const l2 = new THREE.Mesh(leg, mat); l2.position.set(0.075, H * 0.23, 0);
  // 躯干
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, H * 0.26, 4, 10), mat);
  torso.position.y = H * 0.62;
  // 头
  const head = new THREE.Mesh(new THREE.SphereGeometry(H * 0.072, 12, 10), mat);
  head.position.y = H * 0.90;
  // 手臂
  const arm = new THREE.CapsuleGeometry(0.048, H * 0.24, 4, 8);
  const a1 = new THREE.Mesh(arm, mat); a1.position.set(-0.185, H * 0.62, 0); a1.rotation.z = 0.10;
  const a2 = new THREE.Mesh(arm, mat); a2.position.set(0.185, H * 0.62, 0); a2.rotation.z = -0.10;
  g.add(l1, l2, torso, head, a1, a2);

  if (umbrella) {
    const um = new THREE.Group();
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.52, 0.20, 24, 1, true),
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { uCol: { value: new THREE.Color(umbColor) }, uRim: { value: new THREE.Color(0xffc08a) } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 w = modelMatrix*vec4(position,1.0);
            vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz);
            gl_Position = projectionMatrix*viewMatrix*w; }`,
        fragmentShader: `uniform vec3 uCol,uRim; varying vec3 vN; varying vec3 vV;
          void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
            gl_FragColor = vec4(uCol + uRim * pow(f,3.0) * 1.1, 1.0); }`,
      })
    );
    canopy.position.y = 0.10;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.72, 5),
      new THREE.MeshBasicMaterial({ color: umbColor }));
    pole.position.y = -0.26;
    um.add(canopy, pole);
    um.position.set(0.20, H * 0.90, 0.02);
    um.rotation.z = -0.06;
    g.add(um);
    g.userData.umbrella = um;
  }
  g.userData.mat = mat;
  return g;
}

/* ---------------------------------------------------------- 光锥 / 体积光 */
export function createLightCone(opts = {}) {
  const { color = 0xff9b45, height = 9, rTop = 0.1, rBot = 2.6, opacity = 0.13, seg = 24 } = opts;
  const geo = new THREE.CylinderGeometry(rTop, rBot, height, seg, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uC: { value: new THREE.Color(color) }, uO: { value: opacity }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0);
        vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uC; uniform float uO; uniform float uTime;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
        float fall = smoothstep(1.0, 0.0, vUv.y);
        float flick = 0.92 + 0.08*sin(uTime*7.0 + vUv.y*9.0);
        float a = uO * fres * fall * fall * flick;
        gl_FragColor = vec4(uC * (0.6+fall*0.9), a);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return m;
}

/* ---------------------------------------------------------- 尘埃粒子 */
export function createDust(opts = {}) {
  const { count = 900, box = [14, 8, 14], size = 0.035, color = 0xffd9a8, opacity = 0.55, seed = 12, rise = 0.12 } = opts;
  const rnd = rng(seed);
  const pos = new Float32Array(count * 3);
  const ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * box[0];
    pos[i * 3 + 1] = (rnd() - 0.5) * box[1];
    pos[i * 3 + 2] = (rnd() - 0.5) * box[2];
    ph[i] = rnd() * 6.28;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uSize: { value: size }, uC: { value: new THREE.Color(color) },
      uO: { value: opacity }, uRes: { value: new THREE.Vector2(1920, 804) }, uRise: { value: rise },
    },
    vertexShader: `attribute float aPh; uniform float uTime, uSize, uRise; uniform vec2 uRes;
      varying float vA;
      void main(){
        vec3 p = position;
        p.y += sin(uTime*0.35 + aPh)*0.35 + uRise*uTime;
        p.x += sin(uTime*0.22 + aPh*1.7)*0.28;
        vec4 mv = viewMatrix * modelMatrix * vec4(p,1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = clamp(uSize * 900.0 / max(d, 0.001), 0.8, 7.0);
        vA = smoothstep(0.0,1.0, 0.55 + 0.45*sin(uTime*1.7 + aPh*3.1));
        vA *= smoothstep(45.0, 6.0, d) * smoothstep(0.0, 1.5, d);
      }`,
    fragmentShader: `uniform vec3 uC; uniform float uO; varying float vA;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.02, length(q));
        gl_FragColor = vec4(uC, a * vA * uO);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return pts;
}

/* ---------------------------------------------------------- 天空球/渐变背景 */
export function createSkyDome(opts = {}) {
  const { top = 0x03060c, horizon = 0x101c28, glow = 0x2a1a10, size = 400, glowDir = [0, 0.03, -1], glowAmt = 1.0 } = opts;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) }, uHor: { value: new THREE.Color(horizon) },
      uGlow: { value: new THREE.Color(glow) }, uDir: { value: new THREE.Vector3(...glowDir) },
      uAmt: { value: glowAmt },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position;
      gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 uTop,uHor,uGlow,uDir; uniform float uAmt; varying vec3 vP;
      void main(){
        vec3 d = normalize(vP);
        float h = clamp(d.y*0.5+0.5,0.0,1.0);
        vec3 c = mix(uHor, uTop, smoothstep(0.48,0.92,h));
        float g = pow(max(0.0, dot(d, normalize(uDir))), 5.0);
        c += uGlow * g * uAmt;
        gl_FragColor = vec4(c,1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 20), mat);
  m.frustumCulled = false;
  return m;
}

/* ---------------------------------------------------------- 电影字体覆盖层 */
export function setCard(html, style = {}) {
  const el = document.getElementById('card');
  if (!el) return;
  el.innerHTML = html;
  el.style.opacity = style.opacity ?? 1;
  el.style.letterSpacing = style.tracking ?? '0.5em';
  el.style.transform = `translateY(${style.dy ?? 0}px)`;
  el.style.filter = `blur(${style.blur ?? 0}px)`;
}
export function hideCard() {
  const el = document.getElementById('card');
  if (el) { el.innerHTML = ''; el.style.opacity = 0; }
}
export function setVignette(v) {
  const el = document.getElementById('vig');
  if (el) el.style.opacity = v;
}
export function setFade(v) {
  const el = document.getElementById('fade');
  if (el) el.style.opacity = v;
}
