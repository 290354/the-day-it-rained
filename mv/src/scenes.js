import * as THREE from 'three';
import {
  rng, lerp, clamp, smooth, easeInOut, GLSL_NOISE,
  createRain, createDust, createSkyDome, texBokeh, texGlow, createSplashes,
} from './lib.js';
import { setLights, litMaterial, LIGHTS } from './lighting.js';
import {
  createPerson, createUmbrella, createShelter, createStopSign, createBench,
  createBin, createRailing, createStreetLamp, createBus, createBusInterior,
  signTexture, neonSign, rimMaterial,
} from './props.js';
import { buildStreet, buildBlocks, buildSkyline, buildWires, facadeMaterial } from './city.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function handheld(t, amp = 0.012, freq = 0.7) {
  return V3(
    Math.sin(t * freq * 1.7) * amp + Math.sin(t * freq * 4.3) * amp * 0.35,
    Math.cos(t * freq * 1.3) * amp * 0.8 + Math.sin(t * freq * 5.1) * amp * 0.3,
    0
  );
}
function aim(cam, target, roll = 0) {
  cam.lookAt(target);
  if (roll) cam.rotation.z += roll;
}

/* 湿地面上的灯影（加色长条） */
function reflectionStreak(scene, x, z, color, w, len, op = 0.16) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({
    map: texGlow(), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, color, opacity: op,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, z);
  scene.add(m);
  return m;
}

/* 商铺霓虹 */
function shopSigns(scene, rnd) {
  const specs = [
    ['面馆', '#ff9a4a', 2.4], ['便利店', '#64d8ff', 3.0], ['书报亭', '#ffd27a', 1.8],
    ['药房', '#6dffb0', 2.2], ['理发', '#ff6f9c', 2.0],
  ];
  specs.forEach(([txt, col, sz], i) => {
    const tex = neonSign(txt, col);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sz * 2.2, sz * 1.1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95 }));
    const side = i % 2 === 0 ? -1 : 1;
    m.position.set(side * (16 / 2 + 4.6), 3.4 + (i % 3) * 1.4, -18 - i * 12);
    m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(m);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(sz * 4, sz * 2.4), new THREE.MeshBasicMaterial({
      map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, color: new THREE.Color(col), opacity: 0.16,
    }));
    glow.position.copy(m.position);
    glow.rotation.copy(m.rotation);
    scene.add(glow);
  });
}

/* ===================================================================
   夜雨站台 —— 真实街景
   =================================================================== */
export function shotStation(opt = {}) {
  const { figures = 1, variant = 0, lamps = true } = opt;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1920 / 804, 0.1, 600);
  const upd = [];
  const rnd = rng(2024);

  scene.add(createSkyDome({ top: 0x02050c, horizon: 0x0d1824, glow: 0x2a1c12, glowDir: [0, 0.03, -1], glowAmt: 1.1, size: 500 }));

  // 街道
  scene.add(buildStreet({ length: 240, roadW: 16, walkW: 5.2 }));

  // 两侧楼
  scene.add(buildBlocks({ side: -1, zFrom: 14, zTo: -170, seed: 13 }));
  scene.add(buildBlocks({ side: 1, zFrom: 14, zTo: -170, seed: 47 }));
  scene.add(buildSkyline({ count: 46, dist: 300, seed: 8 }));
  scene.add(buildWires({ x: -9.5, y: 6.6, spans: 8, spanLen: 16 }));

  shopSigns(scene, rnd);

  // 路灯
  const lampPos = [];
  for (let i = 0; i < 5; i++) {
    const z = -2 - i * 17;
    const side = i % 2 === 0 ? -1 : 1;
    const lp = createStreetLamp({ height: 6.6, warm: 0xffa855 });
    lp.position.set(side * (16 / 2 + 1.3), 0, z);
    lp.rotation.y = side > 0 ? Math.PI : 0;
    scene.add(lp);
    upd.push((t) => lp.userData.update(t));
    lampPos.push({ pos: [side * (16 / 2 + 0.4), 6.2, z], color: 0xffa855, intensity: 26 });
    reflectionStreak(scene, side * (16 / 2 + 0.4), z + 4, 0xff9a48, 2.6, 14, 0.14);
  }

  // 候车亭（左人行道）
  const shelter = createShelter({ w: 5.6, d: 1.8, h: 2.6, adText: '雨', adColor: '#5fd0ff' });
  shelter.position.set(-10.4, 0.16, -7.2);
  shelter.rotation.y = Math.PI / 2;
  scene.add(shelter);
  upd.push((t) => { shelter.userData.glass.uniforms.uT.value = t; });

  // 站牌 / 长椅 / 垃圾桶 / 护栏
  const stop = createStopSign({ name: '环城西路', en: 'HUANCHENG WEST RD.', num: '07' });
  stop.position.set(-12.4, 0.16, -3.6);
  stop.rotation.y = 0.25;
  scene.add(stop);

  const bench = createBench({ len: 2.0 });
  bench.position.set(-11.9, 0.16, -8.6);
  bench.rotation.y = Math.PI / 2;
  scene.add(bench);

  const bin = createBin();
  bin.position.set(-12.2, 0.16, -5.4);
  scene.add(bin);

  const rail = createRailing({ len: 26, h: 1.05, posts: 14 });
  rail.position.set(-8.0, 0.16, -12);
  rail.rotation.y = Math.PI / 2;
  scene.add(rail);

  // 人物
  if (figures > 0) {
    const p1 = createPerson({
      height: 1.74, coat: true, umbrella: { radius: 0.60, color: 0x050810 },
      rim: 0xffb877, rimAmt: 0.50,
    });
    p1.position.set(-10.6, 0.16, -6.6);
    p1.rotation.y = variant === 2 ? 0.2 : -0.35;
    scene.add(p1);

    if (figures > 1) {
      const p2 = createPerson({ height: 1.64, coat: true, rim: 0xffb877, rimAmt: 0.35 });
      p2.position.set(-9.5, 0.16, -5.6);
      p2.rotation.y = 0.9;
      scene.add(p2);
    }
  }

  // 雨 + 溅射
  const rain = createRain({ count: 6000, area: [64, 34, 90], speed: [13, 23], len: [0.8, 2.4], width: 0.014, opacity: 0.40, seed: 33 });
  rain.position.set(0, 0, -18);
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  const splash = createSplashes({ count: 1100, area: [40, 90], speed: 2.4, seed: 17 });
  scene.add(splash); upd.push((t) => splash.userData.update(t));

  // 光
  setLights([
    { pos: [-9.7, 6.2, -2], color: 0xffa855, intensity: 15 },
    { pos: [-10.4, 2.55, -7.2], color: 0xbfe0ff, intensity: 11 },
    { pos: [9.7, 6.2, -19], color: 0xffa855, intensity: 11 },
    { pos: [-14, 3.2, -22], color: 0xff7f9c, intensity: 8 },
  ], { amb: 0x060c14, fogCol: 0x0a1119, fogDen: 0.0075 });

  return {
    scene, camera, bloom: 1.0, exposure: 1.24,
    dof: { focus: 9.5, aperture: 0.60, max: 15 },
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      if (variant === 1) {
        camera.position.set(lerp(1.4, -0.6, e), lerp(0.62, 0.80, e), lerp(3.4, 1.6, e));
        aim(camera, V3(-9.9, lerp(2.2, 2.8, e), -6.6), lerp(-0.02, 0, e));
        camera.fov = lerp(40, 34, e);
      } else if (variant === 2) {
        camera.position.set(lerp(-4.2, -6.0, e), lerp(0.34, 0.46, e), lerp(1.4, -1.2, e));
        aim(camera, V3(lerp(-9.4, -10.2, e), lerp(1.0, 1.4, e), -6.4), lerp(0.04, 0.02, e));
        camera.fov = lerp(44, 36, e);
      } else if (variant === 3) {
        camera.position.set(lerp(-8.0, -8.6, e), lerp(1.52, 1.46, e), lerp(-1.6, -2.6, e));
        aim(camera, V3(-10.5, 1.34, -7.0), lerp(0.01, 0, e));
        camera.fov = lerp(36, 30, e);
      } else {
        camera.position.set(lerp(2.0, -3.2, e), lerp(1.64, 1.55, e), lerp(3.0, -1.4, e));
        aim(camera, V3(lerp(-9.0, -10.2, e), lerp(1.62, 1.46, e), -6.8), lerp(-0.01, 0, e));
        camera.fov = lerp(33, 28, e);
      }
      camera.position.add(handheld(t, 0.013, 0.85));
      camera.updateProjectionMatrix();
    },
  };
}

/* ===================================================================
   空站台（终镜）
   =================================================================== */
export function shotEmptyStation() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1920 / 804, 0.1, 600);
  const upd = [];
  const rnd = rng(909);

  scene.add(createSkyDome({ top: 0x030810, horizon: 0x16283a, glow: 0x3a2a1c, glowDir: [0, 0.04, -1], glowAmt: 0.9, size: 500 }));
  scene.add(buildStreet({ length: 240, roadW: 16, walkW: 5.2 }));
  scene.add(buildBlocks({ side: -1, zFrom: 14, zTo: -170, seed: 21 }));
  scene.add(buildBlocks({ side: 1, zFrom: 14, zTo: -170, seed: 55 }));
  scene.add(buildSkyline({ count: 42, dist: 300, seed: 12 }));
  scene.add(buildWires({ x: -9.5, y: 6.6, spans: 6, spanLen: 16 }));
  shopSigns(scene, rnd);

  const lp = createStreetLamp({ height: 6.6, warm: 0xffa855 });
  lp.position.set(-9.3, 0, -2);
  scene.add(lp); upd.push((t) => lp.userData.update(t));
  reflectionStreak(scene, -9.3, 2.5, 0xff9a48, 2.8, 16, 0.13);

  const shelter = createShelter({ w: 5.6, d: 1.8, h: 2.6, adText: '雨', adColor: '#5fd0ff' });
  shelter.position.set(-10.4, 0.16, -7.2);
  shelter.rotation.y = Math.PI / 2;
  scene.add(shelter);
  upd.push((t) => { shelter.userData.glass.uniforms.uT.value = t * 0.4; });

  const stop = createStopSign({ name: '环城西路', en: 'HUANCHENG WEST RD.', num: '07' });
  stop.position.set(-12.4, 0.16, -3.6);
  stop.rotation.y = 0.25;
  scene.add(stop);

  // 立在站台上的一把撑开的伞
  const umb = createUmbrella({ radius: 0.66, color: 0x04060c, rim: 0xffc08a });
  umb.position.set(-8.80, 1.05, -2.4);
  umb.rotation.set(0.05, 0.7, 0.03);
  scene.add(umb);
  const poleStand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.10, 6),
    new THREE.MeshBasicMaterial({ color: 0x0a0d14 }));
  poleStand.position.set(-8.80, 0.52, -2.4);
  scene.add(poleStand);
  // 伞后的光
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, color: 0xffa661, opacity: 0.26,
  }));
  glow.position.set(-8.80, 1.55, -3.2);
  scene.add(glow);

  // 雨将停：少量雨丝 + 悬浮水珠
  const rain = createRain({ count: 900, area: [54, 28, 70], speed: [3, 6], len: [0.4, 1.1], width: 0.008, opacity: 0.13, seed: 101 });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  const frozen = createDust({ count: 800, box: [26, 9, 30], size: 0.05, color: 0xd8ecff, opacity: 0.45, seed: 23, rise: 0.0 });
  frozen.position.set(-8, 3.2, -8);
  scene.add(frozen); upd.push((t) => frozen.userData.update(t * 0.12));

  setLights([
    { pos: [-9.7, 6.2, -2], color: 0xffa855, intensity: 28 },
    { pos: [-10.4, 2.55, -7.2], color: 0xbfe0ff, intensity: 7 },
    { pos: [9.7, 6.2, -19], color: 0xffa855, intensity: 18 },
    { pos: [-14, 3.2, -24], color: 0x6fc4ff, intensity: 9 },
  ], { amb: 0x060b12, fogCol: 0x0b131c, fogDen: 0.0072 });

  return {
    scene, camera, bloom: 1.0, exposure: 1.30,
    dof: { focus: 7.5, aperture: 0.60, max: 15 },
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      camera.position.set(lerp(-4.0, -1.4, e), lerp(1.10, 1.85, e), lerp(2.0, 10.0, e));
      aim(camera, V3(lerp(-8.6, -8.2, e), lerp(1.22, 1.44, e), -5.6), lerp(0.006, 0, e));
      camera.position.add(handheld(t, 0.006, 0.32));
      camera.fov = lerp(33, 40, e);
      camera.updateProjectionMatrix();
    },
  };
}

/* ===================================================================
   积水倒影 —— 贴地看街道
   =================================================================== */
export function shotPuddle() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1920 / 804, 0.05, 300);
  const upd = [];
  const rnd = rng(313);

  scene.add(createSkyDome({ top: 0x01040a, horizon: 0x0b1622, glow: 0x2b1a10, size: 300 }));
  scene.add(buildStreet({ length: 200, roadW: 16, walkW: 5.2 }));
  scene.add(buildBlocks({ side: -1, zFrom: 8, zTo: -150, seed: 61 }));
  scene.add(buildBlocks({ side: 1, zFrom: 8, zTo: -150, seed: 77 }));
  scene.add(buildSkyline({ count: 36, dist: 260, seed: 3 }));
  shopSigns(scene, rnd);

  for (let i = 0; i < 4; i++) {
    const lp = createStreetLamp({ height: 6.4, warm: 0xffa855 });
    const side = i % 2 === 0 ? -1 : 1;
    lp.position.set(side * 9.3, 0, -6 - i * 15);
    lp.rotation.y = side > 0 ? Math.PI : 0;
    scene.add(lp); upd.push((t) => lp.userData.update(t));
    reflectionStreak(scene, side * 9.0, -1 - i * 15, 0xff9a48, 3.0, 20, 0.16);
  }
  // 霓虹在湿沥青上的倒影
  reflectionStreak(scene, -9.4, -24, 0xff7f9c, 2.0, 12, 0.10);
  reflectionStreak(scene, 9.4, -30, 0x64d8ff, 2.2, 14, 0.10);

  const rain = createRain({ count: 4200, area: [50, 26, 54], speed: [12, 20], len: [0.7, 1.9], width: 0.012, opacity: 0.38, seed: 55 });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  const splash = createSplashes({ count: 1500, area: [26, 40], speed: 2.8, seed: 71 });
  splash.position.set(0, 0, -14);
  scene.add(splash); upd.push((t) => splash.userData.update(t));

  const near = createDust({ count: 220, box: [7, 3, 5], size: 0.09, color: 0xcfe6ff, opacity: 0.30, seed: 91, rise: -0.02 });
  near.position.set(0, 0.9, 2.2);
  scene.add(near); upd.push((t) => near.userData.update(t));

  setLights([
    { pos: [-9.2, 6.2, -6], color: 0xffa855, intensity: 30 },
    { pos: [9.2, 6.2, -21], color: 0xffa855, intensity: 24 },
    { pos: [-12, 3.4, -24], color: 0xff7f9c, intensity: 12 },
    { pos: [12, 3.4, -30], color: 0x64d8ff, intensity: 10 },
  ], { amb: 0x04080d, fogCol: 0x080f17, fogDen: 0.0090 });

  return {
    scene, camera, bloom: 1.1, exposure: 1.12,
    dof: { focus: 7.0, aperture: 0.62, max: 16 },
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      camera.position.set(lerp(-2.6, -0.8, e), lerp(0.26, 0.52, e), lerp(3.2, 1.6, e));
      aim(camera, V3(lerp(-1.0, 1.2, e), lerp(1.6, 2.4, e), -16), lerp(0.03, 0.01, e));
      camera.position.add(handheld(t, 0.008, 0.6));
    },
  };
}

/* ===================================================================
   公交车内 —— 真实车厢
   =================================================================== */
export function shotBus() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1920 / 804, 0.05, 120);
  const upd = [];

  const interior = createBusInterior({ len: 12, w: 2.45, h: 2.35 });
  interior.position.set(0, 0, -3.0);
  scene.add(interior);

  // 窗外：随车速移动的雨夜街
  const winMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSpeed: { value: 1.0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uTime, uSpeed; varying vec2 vUv;
      void main(){
        vec2 uv = vUv;
        vec3 c = vec3(0.008,0.013,0.022);
        // 建筑窗格横向掠过
        vec2 g = vec2(uv.x*9.0 - uTime*uSpeed*0.42, uv.y*5.0);
        vec2 id = floor(g); vec2 f = fract(g);
        float on = step(0.62, hash21(id*1.7));
        float win = smoothstep(0.15,0.22,f.x)*(1.0-smoothstep(0.78,0.85,f.x))
                  * smoothstep(0.18,0.26,f.y)*(1.0-smoothstep(0.80,0.86,f.y));
        vec3 wc = mix(vec3(1.0,0.72,0.40), vec3(0.5,0.72,1.0), step(0.75, hash21(id+9.1)));
        c += wc * on * win * 0.85;
        // 街灯扫过
        float sweep = pow(max(0.0, sin(uv.x*6.28 - uTime*uSpeed*1.25)), 16.0);
        c += vec3(1.0,0.70,0.36) * sweep * 0.32;
        // 远处车灯拖影
        float trail = pow(max(0.0, sin(uv.x*3.14 - uTime*uSpeed*2.2 + 1.0)), 8.0);
        c += vec3(1.0,0.55,0.3) * trail * 0.16;
        // 玻璃雨痕
        float wet = 0.0;
        for(int i=0;i<8;i++){
          float fi=float(i);
          float xx = hash21(vec2(fi*3.7,2.1));
          float w = 0.002+hash21(vec2(fi,4.4))*0.005;
          float yy = fract(uTime*0.06 + fi*0.29);
          float band = smoothstep(w,0.0,abs(uv.x-(xx+sin(uv.y*5.0+fi)*0.008)));
          band *= smoothstep(yy-0.55,yy-0.05,uv.y)*smoothstep(yy+0.05,yy,uv.y);
          wet += band;
        }
        c += vec3(0.35,0.5,0.62)*wet*0.45;
        gl_FragColor = vec4(c,1.0);
      }`,
  });
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(11.4, 0.92), winMat);
    win.position.set(s * 1.19, 1.54, -3.0);
    win.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(win);
  }
  // 前后风挡
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4), winMat);
  front.position.set(0, 1.62, -8.9);
  scene.add(front);

  // 乘客（坐着的剪影）
  const p = createPerson({ height: 1.62, coat: true, rim: 0xffd0a0, rimAmt: 0.30 });
  p.scale.setScalar(0.96);
  p.position.set(-0.78, 0.02, -2.0);
  p.rotation.y = 0.9;
  scene.add(p);

  // 车厢内的扶手反光
  const rimmat = new THREE.MeshBasicMaterial({ color: 0x2c3540 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 10.5, 8), rimmat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0, 2.02, -3.0);
  scene.add(bar);

  setLights([
    { pos: [0, 2.15, -6.6], color: 0xffe6c0, intensity: 6 },
    { pos: [0, 2.15, -3.2], color: 0xffe6c0, intensity: 6 },
    { pos: [0, 2.15, 0.2], color: 0xffe6c0, intensity: 6 },
    { pos: [-2.2, 1.6, -6.0], color: 0x6fb8ff, intensity: 5 },
  ], { amb: 0x070b10, fogCol: 0x05080d, fogDen: 0.004 });

  return {
    scene, camera, bloom: 0.9, exposure: 1.05,
    dof: { focus: 3.2, aperture: 0.55, max: 13 },
    update(t, dur) {
      upd.forEach((f) => f(t));
      winMat.uniforms.uTime.value = t;
      const k = clamp(t / dur, 0, 1);
      camera.position.set(lerp(0.72, 0.42, k), lerp(1.56, 1.48, k), lerp(2.0, 0.5, k));
      aim(camera, V3(lerp(-0.62, -0.48, k), 1.52, -7.6), 0.006);
      camera.position.add(handheld(t, 0.018, 1.5));
    },
  };
}

/* ===================================================================
   教室 —— 有窗、有桌椅、有黑板的真教室
   =================================================================== */
export function shotClassroom() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1920 / 804, 0.1, 120);
  const upd = [];

  // 窗外阴雨
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec3 c = mix(vec3(0.42,0.47,0.50), vec3(0.78,0.79,0.76), smoothstep(0.0,0.9,vUv.y));
        float t = fbm(vec2(vUv.x*2.6 + uTime*0.008, vUv.y*2.4));
        c *= 0.78 + 0.34*smoothstep(0.34,0.72,t);
        // 远处树影
        float tree = fbm(vec2(vUv.x*5.0, vUv.y*7.0 + 3.0));
        c *= 1.0 - smoothstep(0.30,0.10,vUv.y)*smoothstep(0.45,0.72,tree)*0.5;
        float rr = 0.0;
        for(int i=0;i<4;i++){
          float fi=float(i);
          float x = fract(vUv.x*(3.0+fi*2.4) + uTime*0.012);
          rr += smoothstep(0.005,0.0,abs(x-0.5))*(0.6+0.4*hash21(vec2(fi,1.0)));
        }
        c -= rr*0.05;
        gl_FragColor = vec4(c*0.80, 1.0);
      }`,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(48, 24), skyMat);
  bg.position.set(0, 4.4, -13.0);
  scene.add(bg); upd.push((t) => { skyMat.uniforms.uTime.value = t; });

  const dark = rimMaterial(0x03050a, 0x000000, 0.0);
  const wallMat = litMaterial(0x3a4048, { spec: 0.06, shininess: 8 });
  const floorMat = litMaterial(0x2a2620, { spec: 0.18, shininess: 14 });

  // 地板 / 天花板
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), litMaterial(0x4a5058, { spec: 0.05 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 4.2, 0);
  scene.add(ceil);

  // 侧墙 + 黑板
  const wallL = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), wallMat);
  wallL.rotation.y = Math.PI / 2;
  wallL.position.set(-8.4, 3.0, -2);
  scene.add(wallL);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.2), litMaterial(0x14201a, { spec: 0.1 }));
  board.rotation.y = Math.PI / 2;
  board.position.set(-8.34, 2.2, -2.4);
  scene.add(board);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 6.0), dark);
  tray.position.set(-8.30, 1.06, -2.4);
  scene.add(tray);

  // 窗墙：竖梃 + 窗台
  for (let i = 0; i <= 4; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.9, 0.26), dark);
    v.position.set(-6.2 + i * 3.1, 2.6, -12.6);
    scene.add(v);
  }
  for (let j = 0; j <= 2; j++) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.16, 0.26), dark);
    h.position.set(0, 0.85 + j * 1.55, -12.6);
    scene.add(h);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(13.0, 0.30, 0.7), litMaterial(0x5a5f66, { spec: 0.2 }));
  sill.position.set(0, 0.72, -12.3);
  scene.add(sill);

  // 课桌 + 椅子
  const woodMat = litMaterial(0x4a3d2c, { spec: 0.22, shininess: 22 });
  const metalMat = litMaterial(0x2a2e33, { spec: 0.35, shininess: 40 });
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const x = -4.6 + c * 2.9;
      const z = -8.6 + r * 2.6;
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.62), woodMat);
      top.position.set(x, 0.76, z);
      scene.add(top);
      for (const [dx, dz] of [[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.76, 0.04), metalMat);
        leg.position.set(x + dx, 0.38, z + dz);
        scene.add(leg);
      }
      // 椅子
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.42), woodMat);
      seat.position.set(x, 0.44, z + 0.58);
      scene.add(seat);
      const backR = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.05), woodMat);
      backR.position.set(x, 0.66, z + 0.78);
      scene.add(backR);
    }
  }

  // 吊灯
  for (let i = 0; i < 3; i++) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.10, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xc8d4e2 }));
    lamp.position.set(-2.0 + i * 2.6, 3.95, -5.0);
    scene.add(lamp);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({
      map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, color: 0xdfe9ff, opacity: 0.16,
    }));
    gl.rotation.x = Math.PI / 2;
    gl.position.set(-2.0 + i * 2.6, 3.85, -5.0);
    scene.add(gl);
  }

  // 光柱
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 17), new THREE.MeshBasicMaterial({
      map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      color: 0xfff0d2, opacity: 0.15,
    }));
    m.position.set(-4.65 + i * 3.1, 2.4, -6.4);
    m.rotation.set(-0.70, 0, 0.04);
    scene.add(m);
  }

  // 靠窗的一个人
  const p = createPerson({ height: 1.68, coat: false, rim: 0xffe0b8, rimAmt: 0.30 });
  p.position.set(-3.4, 0.02, -6.2);
  p.rotation.y = 2.6;
  p.scale.setScalar(0.94);
  scene.add(p);

  const dust = createDust({ count: 1600, box: [16, 8, 16], size: 0.055, color: 0xffeccd, opacity: 0.85, seed: 5, rise: 0.05 });
  dust.position.set(0, 3.0, -6.5);
  scene.add(dust); upd.push((t) => dust.userData.update(t));

  setLights([
    { pos: [0, 3.9, -14], color: 0xdce8f5, intensity: 26 },
    { pos: [-1.8, 3.9, -5.0], color: 0xfff1d6, intensity: 7 },
    { pos: [2.0, 3.9, -5.0], color: 0xfff1d6, intensity: 7 },
    { pos: [1.6, 3.5, -5.2], color: 0xffe8c8, intensity: 9 },
  ], { amb: 0x0d1218, fogCol: 0x0e1418, fogDen: 0.010 });

  return {
    scene, camera, bloom: 0.9, exposure: 0.98,
    dof: { focus: 9.0, aperture: 0.55, max: 13 },
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      camera.position.set(lerp(1.6, 0.6, e), lerp(1.62, 1.48, e), lerp(7.6, 4.0, e));
      aim(camera, V3(-1.8, 2.2, -12.2), lerp(-0.008, 0.004, e));
      camera.position.add(handheld(t, 0.010, 0.55));
      camera.fov = lerp(34, 28, e);
      camera.updateProjectionMatrix();
    },
  };
}
