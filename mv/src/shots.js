import * as THREE from 'three';
import {
  rng, lerp, clamp, smooth, easeInOut, easeOut, easeIn,
  GLSL_NOISE, createRain, createWetGround, createFigure, createLightCone,
  createDust, createSkyDome, bokehField, texBokeh, texGlow, texDust, createSplashes,
} from './lib.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* 手持微抖（确定性噪声） */
function handheld(t, amp = 0.012, freq = 0.7) {
  return V3(
    Math.sin(t * freq * 1.7) * amp + Math.sin(t * freq * 4.3) * amp * 0.35,
    Math.cos(t * freq * 1.3) * amp * 0.8 + Math.sin(t * freq * 5.1) * amp * 0.3,
    0
  );
}

/* 让相机看向 target，并可 roll */
function aim(cam, target, roll = 0) {
  cam.lookAt(target);
  if (roll) cam.rotation.z += roll;
}

/* 屏幕空间全屏 quad（正交） */
function fullscreenQuad(shader, uniforms) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({ ...shader, uniforms, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(mesh);
  return { scene, camera: cam, mesh, mat };
}

/* ===================================================================
   1. 云层俯冲 —— 好莱坞式冷开场
   =================================================================== */
export function shotCloudDive() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1920 / 804, 0.1, 3000);
  const upd = [];

  scene.add(createSkyDome({ top: 0x050a14, horizon: 0x16242f, glow: 0x6b4322, glowDir: [0, -0.18, -1], glowAmt: 1.0, size: 900 }));

  // 云层 4 层
  const cloudMat = (seed, speed, scale, op) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uSeed: { value: seed }, uSpeed: { value: speed },
      uScale: { value: scale }, uOp: { value: op },
      uC1: { value: new THREE.Color(0x1b2a38) }, uC2: { value: new THREE.Color(0x68798b) },
      uGlow: { value: new THREE.Color(0xffb371) },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz;
        gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uTime,uSeed,uSpeed,uScale,uOp; uniform vec3 uC1,uC2,uGlow;
      varying vec2 vUv; varying vec3 vW;
      void main(){
        vec2 p = vUv*uScale + vec2(uSeed*31.0, uSeed*17.0) + vec2(uTime*uSpeed*0.02, 0.0);
        float f = fbm(p + fbm(p*1.7 + uTime*0.01)*0.6);
        float f2 = fbm(p*2.9 - uTime*uSpeed*0.03);
        float v = f*0.68 + f2*0.46;
        float a = smoothstep(0.34, 0.78, v);
        float rim = smoothstep(0.26, 0.46, v) * (1.0 - smoothstep(0.46, 0.72, v));
        // 云底被城市灯光打亮
        float under = smoothstep(0.55, 1.0, 1.0 - abs(v - 0.5)*2.0);
        vec3 col = mix(uC1, uC2, clamp(f*0.85 + f2*0.35, 0.0, 1.0));
        col += uGlow * rim * 0.52;
        col += uGlow * under * 0.15;
        col *= 1.05;
        gl_FragColor = vec4(col, a*uOp);
      }`,
  });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 1, 1), cloudMat(1 + i * 3.7, 1 + i * 0.6, 2.2 + i * 0.8, 0.92 - i * 0.08));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 64 - i * 19;
    m.renderOrder = i;
    scene.add(m);
    upd.push((t) => { m.material.uniforms.uTime.value = t + i * 3; });
  }

  // 地面：城市灯海
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;
        gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader: `${GLSL_NOISE}
        uniform float uTime; varying vec3 vW;
        void main(){
          vec2 p = vW.xz;
          float cl = fbm(p*0.0022 + 3.1);
          float cluster = smoothstep(0.34, 0.72, cl);
          vec2 gp = abs(fract(p*0.016)-0.5);
          float st = (smoothstep(0.4965,0.5,gp.x)+smoothstep(0.4965,0.5,gp.y)) * cluster;
          float d = hash21(floor(p*0.30));
          float car = step(0.976, d) * (0.55+0.45*sin(uTime*2.0+d*40.0)) * cluster;
          float glow = exp(-length(p)*0.0030);
          vec3 c = vec3(1.0,0.60,0.26)*(st*0.42 + car*2.2)*1.15;
          c += vec3(0.07,0.11,0.19)*glow*0.55*cluster;
          c *= 0.25 + 0.85*cluster;
          gl_FragColor = vec4(c,1.0);
        }`,
    }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  scene.add(ground);
  upd.push((t) => { ground.material.uniforms.uTime.value = t; });

  const rain = createRain({ count: 6000, area: [100, 80, 130], speed: [26, 50], len: [2.4, 5.6], width: 0.022, opacity: 0.36, seed: 21, color: 0xaecdf0 });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  // 高空一层薄雾
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), new THREE.MeshBasicMaterial({
    map: texGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0x6f8092, opacity: 0.10,
  }));
  mist.position.set(0, 30, -320);
  scene.add(mist);

  // 闪电
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xdfeaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(700, 500), flashMat);
  flash.position.set(0, 20, -260);
  scene.add(flash);

  return {
    scene, camera, bloom: 0.75, exposure: 0.95,
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      camera.position.set(lerp(-18, 2, e), lerp(152, 7, Math.pow(e, 0.86)), lerp(120, -26, e));
      aim(camera, V3(0, lerp(38, 3.2, Math.pow(e, 0.9)), lerp(-160, -120, e)), lerp(0.05, 0, e));
      camera.position.add(handheld(t, 0.05, 0.35));
      camera.fov = lerp(40, 32, e);
      camera.updateProjectionMatrix();
      const fl = (a, b) => (t > a && t < b ? Math.exp(-(t - a) * 9) : 0);
      const f = Math.max(fl(dur * 0.16, dur * 0.16 + 0.5), fl(dur * 0.56, dur * 0.56 + 0.4) * 0.7);
      flashMat.opacity = f * 0.85;
      flash.position.x = Math.sin(t * 3) * 40;
      mist.material.opacity = 0.06 + 0.10 * (1 - e);
    },
  };
}

/* ===================================================================
   2. 车窗雨滴微距（程序化，全片母题：一滴雨 = 一个宇宙）
   =================================================================== */
export function shotGlass() {
  const uniforms = {
    uTime: { value: 0 }, uZoom: { value: 0 }, uBright: { value: 1.0 },
    uEye: { value: 0.0 }, uPan: { value: new THREE.Vector2(0, 0) },
  };
  const { scene, camera } = fullscreenQuad({
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uTime,uZoom,uBright,uEye; uniform vec2 uPan;
      varying vec2 vUv;

      vec3 bg(vec2 uv){
        vec2 p = uv + uPan;
        vec3 c = vec3(0.009,0.014,0.023);
        float band = exp(-pow((p.y-0.47)*4.6,2.0));
        c += vec3(0.50,0.26,0.10) * band * 0.26;
        c += vec3(0.045,0.085,0.135) * smoothstep(0.42,1.0,p.y) * 0.55;
        for(int i=0;i<7;i++){
          float fi = float(i);
          vec2 cp = vec2(hash21(vec2(fi*4.7,1.3)), hash21(vec2(fi*9.1,6.7)));
          cp = cp*vec2(1.32,1.05) - vec2(0.16,0.02);
          vec2 d = (uv-cp)*vec2(1.0,0.78);
          float r = 0.048 + hash21(vec2(fi,3.3))*0.075;
          float g = exp(-pow(length(d)/r, 2.3));
          vec3 lc = mix(vec3(1.0,0.56,0.24), vec3(0.36,0.70,1.0), step(0.58, hash21(vec2(fi,8.1))));
          c += lc * g * (0.42 + 0.48*hash21(vec2(fi,2.9)));
        }
        return c;
      }

      void main(){
        vec2 uv = vUv;
        vec2 uvz = (uv - 0.5) * (1.0 - uZoom*0.16) + 0.5;
        vec3 col = bg(uvz);

        // 三层玻璃水珠
        for(int L=0; L<3; L++){
          float Lf = float(L);
          float s = 8.0 + Lf*9.0;
          vec2 g = uvz*s + vec2(0.0, uTime*(0.020 + 0.014*Lf));
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5;
          float h1 = hash21(id + Lf*13.0);
          float h2 = hash21(id + Lf*29.0);
          float h3 = hash21(id + Lf*7.7);
          if(h3 > 0.50){
            float r = (0.42 - Lf*0.10) * (0.30 + 0.70*h1);
            vec2 c = vec2((h2-0.5)*0.40, (h1-0.5)*0.26);
            vec2 d = f - c;
            float dist = length(d);
            float m = smoothstep(r, r*0.70, dist);
            vec2 nrm = normalize(d + vec2(1e-5));
            float fade = 1.0 - smoothstep(0.0, r*0.95, dist);
            vec2 off = -nrm * fade * r * 0.085;
            vec2 base = uvz + off;
            vec3 rr;
            rr.r = bg(base + off*0.16).r;
            rr.g = bg(base).g;
            rr.b = bg(base - off*0.16).b;
            rr *= 1.20 + 0.35*(1.0-Lf*0.25);
            float rim = smoothstep(r*0.72, r*0.96, dist) * (1.0 - smoothstep(r*0.96, r*1.04, dist));
            rim *= smoothstep(-0.10, 0.55, d.y/max(r,1e-4));
            rr += vec3(0.42,0.50,0.60) * rim * 0.24;
            float hi = exp(-pow(length(d - vec2(-r*0.30, r*0.32))/(r*0.18), 2.0));
            rr += vec3(1.0,0.96,0.90) * hi * 0.95;
            float caus = exp(-pow(length(d - vec2(0.0, r*0.46))/(r*0.26), 2.0));
            rr += vec3(0.95,0.84,0.68) * caus * 0.30;
            col = mix(col, rr, m);
          }
        }

        // 竖向水痕
        float trail = 0.0;
        for(int i=0;i<6;i++){
          float fi = float(i);
          float x = hash21(vec2(fi*5.7, 3.3));
          float w = 0.0012 + hash21(vec2(fi,8.1))*0.0032;
          float y0 = fract(uTime*0.035 + fi*0.37);
          float band = smoothstep(w, 0.0, abs(uvz.x - (x + sin(uv.y*3.4+fi)*0.005)));
          band *= smoothstep(y0-0.62, y0-0.12, uvz.y) * smoothstep(y0+0.04, y0-0.02, uvz.y);
          trail += band;
        }
        col += vec3(0.26,0.36,0.48) * trail * 0.32;

        // 玻璃冷凝雾
        col = mix(col, col*0.86 + vec3(0.020,0.026,0.036), 0.30);

        col *= uBright;
        float vig = smoothstep(1.10, 0.22, length((uv-0.5)*vec2(1.0,1.30))*1.30);
        col *= mix(0.40, 1.0, vig);
        col = max(col, vec3(0.0));

        if(uEye > 0.001){
          vec2 e = (uv - vec2(0.5,0.51)) * vec2(1.0, 1.28);
          float rr = length(e);
          float iris = smoothstep(0.30,0.27,rr) * smoothstep(0.11,0.15,rr);
          float pupil = smoothstep(0.115,0.085,rr);
          float catch = exp(-pow(length(e-vec2(-0.072,0.068))/0.045, 2.0));
          vec3 eye = mix(vec3(0.055,0.075,0.10), vec3(0.46,0.33,0.22), iris);
          eye *= (1.0 - pupil*0.94);
          eye += vec3(1.0,0.97,0.90) * catch * 0.9;
          eye += vec3(0.10,0.12,0.15) * smoothstep(0.40,0.30,rr);
          eye *= 0.55;
          col = mix(col, eye, uEye);
        }

        gl_FragColor = vec4(col, 1.0);
      }`,
  }, uniforms);

  return {
    scene, camera, bloom: 0.42, exposure: 1.0, quad: true,
    update(t, dur) {
      const k = clamp(t / dur, 0, 1);
      uniforms.uTime.value = t;
      uniforms.uZoom.value = easeInOut(k);
      uniforms.uPan.value.set(-0.022 * k, 0.008 * k);
      uniforms.uBright.value = 0.95 + 0.12 * Math.sin(k * Math.PI);
      uniforms.uEye.value = smooth(Math.max(0, (k - 0.78) / 0.22)) * 0.85;
    },
  };
}

/* 站台结构细节：桁架 / 栏杆 / 长椅 / 站牌 / 时刻表 / 溅射 */
function decorateStation(scene) {
  const truss = new THREE.MeshBasicMaterial({ color: 0x080c12 });
  // 顶棚桁架
  for (let i = 0; i < 8; i++) {
    const x = -15.5 + i * 4.6;
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 15.4), truss);
    v.position.set(x, 4.02, -12.1); scene.add(v);
    const d1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3.4), truss);
    d1.position.set(x + 2.3, 4.24, -9.4); d1.rotation.x = 0.56; scene.add(d1);
    const d2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3.4), truss);
    d2.position.set(x + 2.3, 4.24, -14.8); d2.rotation.x = -0.56; scene.add(d2);
  }
  // 站台栏杆
  for (let i = 0; i < 16; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.05, 6), truss);
    p.position.set(-14.6 + i * 1.95, 0.52, -3.75); scene.add(p);
  }
  for (const y of [1.02, 0.62]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 31, 6), truss);
    r.rotation.z = Math.PI / 2; r.position.set(0, y, -3.75); scene.add(r);
  }
  // 长椅
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.07, 0.42), truss);
  seat.position.y = 0.44;
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, 0.05), truss);
  back.position.set(0, 0.66, -0.20);
  bench.add(seat, back);
  for (const dx of [-1.1, 1.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.34), truss);
    leg.position.set(dx, 0.22, 0); bench.add(leg);
  }
  bench.position.set(-6.9, 0, -7.4); bench.rotation.y = 0.08;
  scene.add(bench);

  // 站牌（背光板）
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#0a1116'; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = 'rgba(150,180,205,0.28)'; g.lineWidth = 3; g.strokeRect(9, 9, 1006, 238);
  g.fillStyle = '#e9f0f6';
  g.font = '600 92px "Microsoft YaHei", sans-serif';
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('环城西路', 54, 104);
  g.fillStyle = 'rgba(188,208,224,0.62)';
  g.font = '34px "Bahnschrift", "Segoe UI", sans-serif';
  g.fillText('HUANCHENG WEST RD.', 58, 186);
  g.fillStyle = '#2b7cae'; g.fillRect(776, 58, 196, 58);
  g.fillStyle = '#dfeaf2'; g.font = 'bold 40px "Bahnschrift", sans-serif';
  g.textAlign = 'center'; g.fillText('07', 874, 88);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.82),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92 }));
  sign.position.set(-5.4, 2.62, -8.2); sign.rotation.y = 0.16;
  scene.add(sign);
  const sGlow = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.35), new THREE.MeshBasicMaterial({
    map: texGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0x8fc4f0, opacity: 0.05, side: THREE.DoubleSide,
  }));
  sGlow.position.set(-5.4, 2.62, -8.16); sGlow.rotation.y = 0.16;
  scene.add(sGlow);

  // 时刻表灯箱
  const cv2 = document.createElement('canvas');
  cv2.width = 256; cv2.height = 512;
  const g2 = cv2.getContext('2d');
  g2.fillStyle = '#0c151b'; g2.fillRect(0, 0, 256, 512);
  g2.fillStyle = 'rgba(200,220,235,0.85)'; g2.font = '18px "Bahnschrift", sans-serif';
  g2.fillText('LAST  TRAIN', 26, 46);
  for (let i = 0; i < 11; i++) {
    g2.fillStyle = `rgba(190,215,232,${0.24 - i * 0.012})`;
    g2.fillRect(26, 76 + i * 36, 120 + (i % 3) * 26, 5);
  }
  g2.fillStyle = 'rgba(120,190,240,0.55)';
  g2.fillRect(26, 470, 90, 3);
  const tex2 = new THREE.CanvasTexture(cv2);
  tex2.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8),
    new THREE.MeshBasicMaterial({ map: tex2, transparent: true, opacity: 0.8 }));
  board.position.set(3.4, 1.55, -7.2); board.rotation.y = -0.5;
  scene.add(board);

  // 远景城市剪影 + 稀疏窗灯
  const far = new THREE.MeshBasicMaterial({ color: 0x020409 });
  const rnd = rng(717);
  for (let i = 0; i < 26; i++) {
    const w = 8 + rnd() * 14;
    const h = 5 + rnd() * 13;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), far);
    b.position.set(-120 + i * 10.5 + (rnd() - 0.5) * 6, h / 2 - 1, -155 - rnd() * 55);
    scene.add(b);
  }
  const winMat = new THREE.PointsMaterial({
    color: 0xffc390, size: 0.55, sizeAttenuation: true,
    transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const wpos = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    wpos[i * 3] = -118 + rnd() * 268;
    wpos[i * 3 + 1] = 3 + rnd() * 22;
    wpos[i * 3 + 2] = -150 - rnd() * 55;
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
  const wins = new THREE.Points(wg, winMat);
  scene.add(wins);

  // 雨溅
  const splash = createSplashes({ count: 760, area: [30, 26], speed: 2.4, seed: 17 });
  scene.add(splash);
  return splash;
}

/* ===================================================================
   3. 夜雨站台
   =================================================================== */
export function shotStation(opt = {}) {
  const { lamps = true, figures = 2, umbrellaStand = false, variant = 0 } = opt;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1920 / 804, 0.1, 400);
  const upd = [];

  scene.add(createSkyDome({ top: 0x02060c, horizon: 0x0c1a24, glow: 0x2a1b12, glowDir: [0, 0.02, -1], glowAmt: 1.7, size: 300 }));

  // 地面
  const ground = createWetGround({ size: [120, 160], refl: 1.15, intensity: 1.0, glowColor: new THREE.Color(0xffa04a) });
  ground.position.y = 0;
  scene.add(ground); upd.push((t) => ground.userData.update(t));

  // 站台顶棚
  const dark = new THREE.MeshBasicMaterial({ color: 0x030508 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 16), dark);
  roof.position.set(0, 4.4, -12);
  scene.add(roof);
  const roofEdge = new THREE.Mesh(new THREE.BoxGeometry(46, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0x6b5540 }));
  roofEdge.position.set(0, 4.6, -4.05);
  scene.add(roofEdge);

  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 4.4, 6), dark);
    c.position.set(-16 + i * 6.4, 2.2, -4.2);
    scene.add(c);
  }

  // 钠灯
  if (lamps) {
    for (let i = 0; i < 2; i++) {
      const x = -8 + i * 16;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      bulb.position.set(x, 4.05, -8);
      scene.add(bulb);
      const cone = createLightCone({ color: 0xff9b45, height: 5.6, rTop: 0.12, rBot: 3.4, opacity: 0.085 });
      cone.position.set(x, 1.5, -8);
      scene.add(cone); upd.push((t) => cone.userData.update(t));
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({
        map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        color: 0xffa855, opacity: 0.55,
      }));
      glow.position.set(x, 4.05, -8);
      scene.add(glow);
    }
  }

  // 地平线暖光（把人物衬成剪影）
  const cityGlow = new THREE.Mesh(new THREE.PlaneGeometry(120, 26), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0x8fb4e0, opacity: 0.10,
  }));
  cityGlow.position.set(-2, 3.2, -34);
  scene.add(cityGlow);

  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(300, 130), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffa864, opacity: 0.22,
  }));
  horizon.position.set(0, 7.0, -78);
  scene.add(horizon);

  // 远景灯海
  const bg = bokehField(110, [170, 13, 90], rng(41), (r) => {
    const c = new THREE.Color();
    const t = r();
    if (t < 0.55) c.setHex(0xff9b45);
    else if (t < 0.85) c.setHex(0x53b7ff);
    else c.setHex(0xffe2b0);
    return c;
  }, [0.28, 1.45]);
  bg.position.set(0, 3.6, -58);
  scene.add(bg);

  // 人
  if (figures > 0) {
    const f1 = createFigure({ height: 1.74, umbrella: true });
    f1.position.set(-2.35, 0, -6.4);
    f1.rotation.y = 0.35;
    scene.add(f1);
    if (figures > 1) {
      const f2 = createFigure({ height: 1.66 });
      f2.position.set(-0.85, 0, -5.9);
      f2.rotation.y = -0.55;
      scene.add(f2);
    }
  }
  if (umbrellaStand) {
    const um = createFigure({ height: 1.0, umbrella: false });
    um.visible = false;
    const stand = new THREE.Mesh(new THREE.ConeGeometry(0.86, 0.34, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x05070c, side: THREE.DoubleSide }));
    stand.position.set(2.6, 1.05, -8.0);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.05, 6),
      new THREE.MeshBasicMaterial({ color: 0x0a0d14 }));
    pole.position.set(2.6, 0.52, -8.0);
    scene.add(stand, pole);
  }

  // 雨
  const rain = createRain({ count: 5000, area: [70, 40, 70], speed: [13, 22], len: [0.7, 2.2], width: 0.013, opacity: 0.42, seed: 33 });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  const splash = decorateStation(scene);
  upd.push((t) => splash.userData.update(t));

  // 雨丝体积感
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(300, 150), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, opacity: 0.030, depthWrite: false,
    color: 0x8fb2d6,
  }));
  mist.position.set(0, 9, -62);
  scene.add(mist);

  return {
    scene, camera, bloom: 1.02, exposure: 1.30,
    dof: { focus: 7.2, aperture: 0.62, max: 14 },
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      if (variant === 1) {
        // 低机位仰角：雨的重量压下来
        camera.position.set(lerp(-3.0, -2.2, e), lerp(0.52, 0.72, e), lerp(2.0, 0.6, e));
        aim(camera, V3(-2.6, lerp(2.6, 3.1, e), -6.2), lerp(-0.03, -0.01, e));
        camera.fov = lerp(40, 34, e);
      } else if (variant === 2) {
        // 贴地平视：看积水与灯影
        camera.position.set(lerp(3.6, 2.4, e), lerp(0.30, 0.42, e), lerp(1.6, 0.2, e));
        aim(camera, V3(lerp(0.6, 0.2, e), lerp(1.1, 1.35, e), -6.6), lerp(0.05, 0.02, e));
        camera.fov = lerp(46, 38, e);
      } else if (variant === 3) {
        // 人物背面过肩
        camera.position.set(lerp(-4.2, -3.5, e), lerp(1.52, 1.44, e), lerp(-11.6, -12.4, e));
        aim(camera, V3(lerp(-2.6, -2.2, e), lerp(1.30, 1.34, e), -4.2), lerp(-0.01, 0, e));
        camera.fov = lerp(34, 30, e);
      } else {
        // 横移 dolly
        camera.position.set(lerp(-4.6, -1.2, e), 1.62 + Math.sin(t * 0.4) * 0.02, lerp(3.2, 1.4, e));
        aim(camera, V3(lerp(-1.5, -1.3, e), 1.30, -6.4), lerp(-0.012, 0, e));
        camera.fov = lerp(34, 30, e);
      }
      camera.position.add(handheld(t, 0.014, 0.9));
      camera.updateProjectionMatrix();
    },
  };
}

/* ===================================================================
   4. 公交车内 —— 窗外灯光扫过
   =================================================================== */
export function shotBus() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1920 / 804, 0.1, 100);
  const upd = [];

  const uniforms = {
    uTime: { value: 0 }, uSpeed: { value: 1.0 }, uWet: { value: 1.0 },
  };
  // 车窗：程序化窗外
  const winMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uTime,uSpeed,uWet; varying vec2 vUv;
      void main(){
        vec2 uv = vUv;
        vec3 c = vec3(0.01,0.017,0.03);
        // 远处灯带横向移动
        float x = uv.x*3.0 - uTime*uSpeed*0.55;
        float lane = smoothstep(0.30,0.0,abs(fract(x*2.0)-0.5)-0.16);
        c += vec3(1.0,0.6,0.25)*lane*0.55;
        // 建筑窗格
        vec2 g = vec2(uv.x*10.0 - uTime*uSpeed*0.35, uv.y*7.0);
        float win = step(0.62, hash21(floor(g)))*smoothstep(0.55,0.35,uv.y)*smoothstep(0.05,0.25,uv.y);
        c += vec3(0.75,0.82,1.0)*win*0.30;
        // 街灯光晕扫过
        float sweep = pow(max(0.0,sin(uv.x*6.28 - uTime*uSpeed*1.6)), 14.0);
        c += vec3(1.0,0.7,0.35)*sweep*0.85;
        // 雨痕
        float wet = 0.0;
        for(int i=0;i<7;i++){
          float fi=float(i);
          float xx = hash21(vec2(fi*3.7,2.1));
          float w = 0.002+hash21(vec2(fi,4.4))*0.004;
          float yy = fract(uTime*0.05 + fi*0.31);
          float band = smoothstep(w,0.0,abs(uv.x-(xx+sin(uv.y*4.0+fi)*0.01)));
          band *= smoothstep(yy-0.6,yy-0.05,uv.y)*smoothstep(yy+0.05,yy,uv.y);
          wet += band;
        }
        c += vec3(0.35,0.5,0.6)*wet*0.5*uWet;
        // 水珠
        for(int i=0;i<14;i++){
          float fi=float(i);
          vec2 cp = vec2(hash21(vec2(fi*1.7,3.3)), fract(hash21(vec2(fi*9.1,7.7))+uTime*0.02));
          float r = 0.008+hash21(vec2(fi,1.1))*0.017;
          vec2 d=(uv-cp)*vec2(3.2,1.0);
          float m = smoothstep(r,r*0.5,length(d));
          c += vec3(0.7,0.8,0.95)*m*0.35*uWet;
        }
        gl_FragColor = vec4(c,1.0);
      }`,
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 3.0), winMat);
  win.position.set(0, 2.05, -3.4);
  scene.add(win); upd.push((t) => { uniforms.uTime.value = t; });

  // 车厢框架剪影（黑）
  const dark = new THREE.MeshBasicMaterial({ color: 0x010204 });
  const mk = (w, h, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), dark);
    m.position.set(x, y, z); scene.add(m); return m;
  };
  mk(9.4, 0.55, 0, 3.75, -3.35);          // 窗上梁
  mk(9.4, 1.1, 0, 0.45, -3.35);           // 窗下
  for (let i = 0; i < 4; i++) mk(0.14, 3.0, -4.6 + i * 3.06, 2.05, -3.3);
  // 立柱
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.2, 8), dark);
  pillar.position.set(1.55, 2.1, -0.9); scene.add(pillar);
  // 扶手
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 5.4, 8), new THREE.MeshBasicMaterial({ color: 0x2a2f38 }));
  rail.rotation.z = Math.PI / 2; rail.position.set(-0.4, 2.85, -0.85); scene.add(rail);

  // 座椅剪影
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.55), dark);
    s.position.set(-2.6 + i * 1.05, 0.62, 0.35); s.rotation.y = 0.2; scene.add(s);
  }

  // 人物侧影（座位）
  const p = createFigure({ height: 1.62 });
  p.position.set(-1.35, 0.30, 1.0);
  p.rotation.y = 2.5; p.scale.setScalar(0.98);
  scene.add(p);

  // 车顶漏光
  const lk = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.5), new THREE.MeshBasicMaterial({
    color: 0xffd0a0, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  lk.position.set(0, 4.1, -1.0); lk.rotation.x = Math.PI / 2;
  scene.add(lk);

  return {
    scene, camera, bloom: 0.7, exposure: 1.0,
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      camera.position.set(lerp(1.5, 1.1, k), lerp(1.62, 1.55, k), 3.6);
      aim(camera, V3(lerp(-0.4, -0.2, k), 1.72, -3.4), 0.008);
      camera.position.add(handheld(t, 0.02, 1.6));
    },
  };
}

/* ===================================================================
   5. 积水倒影 —— 霓虹与涟漪
   =================================================================== */
export function shotPuddle() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1920 / 804, 0.05, 200);
  const upd = [];

  scene.add(createSkyDome({ top: 0x01030a, horizon: 0x0a1420, glow: 0x2b1a10, size: 200 }));

  const ground = createWetGround({ size: [140, 140], refl: 1.6, ripple: 1.35, intensity: 1.15, glowColor: new THREE.Color(0xff8a3d) });
  scene.add(ground); upd.push((t) => ground.userData.update(t));

  // 霓虹招牌（发光面片 + canvas 文字）
  const neon = (text, color, x, y, z, w, h, rotY = 0) => {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 512, 256);
    g.font = 'bold 120px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 40;
    g.fillStyle = color;
    g.fillText(text, 256, 132);
    g.shadowBlur = 12; g.fillStyle = '#ffffff';
    g.globalAlpha = 0.85; g.fillText(text, 256, 132);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.position.set(x, y, z); m.rotation.y = rotY;
    scene.add(m);
    return m;
  };
  const n1 = neon('雨天', '#ff5f8a', -6.5, 3.2, -12, 5.2, 2.6, 0.28);
  const n2 = neon('書店', '#59d8ff', 7.0, 4.2, -16, 5.0, 2.5, -0.34);
  const n3 = neon('慢', '#ffc46b', 1.6, 2.4, -22, 2.2, 2.2, 0.1);

  // 建筑剪影
  const dark = new THREE.MeshBasicMaterial({ color: 0x010306 });
  for (let i = 0; i < 9; i++) {
    const w = 4 + (i % 3) * 3, h = 10 + ((i * 7) % 5) * 4;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), dark);
    b.position.set(-26 + i * 6.6, h / 2 - 1, -26 - (i % 4) * 4);
    scene.add(b);
  }

  // 霓虹在地面的倒影（竖向拉伸的加色片）
  const refl = (x, z, color, w, h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: texGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      color, opacity: 0.22,
    }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = 0;
    m.position.set(x, 0.02, z);
    scene.add(m);
  };
  refl(-6.5, -9.5, 0xff5f8a, 3.4, 12);
  refl(7.0, -12, 0x59d8ff, 3.0, 14);
  refl(1.6, -19, 0xffc46b, 1.6, 9);

  // 雨
  const rain = createRain({ count: 3600, area: [50, 26, 50], speed: [12, 20], len: [0.6, 1.8], width: 0.012, opacity: 0.40, seed: 55 });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  // 悬浮近景雨滴（微距）
  const near = createDust({ count: 260, box: [8, 4, 6], size: 0.09, color: 0xcfe6ff, opacity: 0.35, seed: 71, rise: -0.02 });
  near.position.set(0, 1.2, 2);
  scene.add(near); upd.push((t) => near.userData.update(t));

  return {
    scene, camera, bloom: 0.9, exposure: 1.05,
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      camera.position.set(lerp(-2.2, -0.6, e), lerp(0.36, 0.62, e), lerp(4.2, 2.6, e));
      aim(camera, V3(lerp(0.2, 1.3, e), lerp(1.4, 2.0, e), -12), lerp(0.02, -0.01, e));
      camera.position.add(handheld(t, 0.008, 0.6));
    },
  };
}

/* ===================================================================
   6. 雨滴倒流 —— 核心转折
   =================================================================== */
export function shotRainReverse() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1920 / 804, 0.1, 400);
  const upd = [];

  scene.add(createSkyDome({ top: 0x020610, horizon: 0x122033, glow: 0x2f3a4a, glowDir: [0, 0.6, -1], glowAmt: 1.4, size: 300 }));

  // 上升的雨
  const rain = createRain({ count: 7000, area: [60, 44, 60], speed: [7, 16], len: [1.2, 3.6], width: 0.014, opacity: 0.55, dir: 1, seed: 91, wind: -0.18 });
  rain.position.y = -18;
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  // 悬浮水滴（静止在空中的雨）
  const suspended = createDust({ count: 900, box: [26, 22, 26], size: 0.055, color: 0xbfe0ff, opacity: 0.55, seed: 17, rise: 0.0 });
  suspended.position.y = 6;
  scene.add(suspended); upd.push((t) => suspended.userData.update(t * 0.6));

  // 体积光柱
  for (let i = 0; i < 3; i++) {
    const c = createLightCone({ color: 0x8fc6ff, height: 30, rTop: 0.6, rBot: 6.0, opacity: 0.075 });
    c.position.set(-10 + i * 10, 14, -14 - i * 3);
    scene.add(c); upd.push((t) => c.userData.update(t));
  }

  // 地面（反向涟漪：用负时间）
  const ground = createWetGround({ size: [80, 80], refl: 0.9, ripple: 1.6, intensity: 0.7, glowColor: new THREE.Color(0x6fa8ff) });
  ground.position.y = -6;
  scene.add(ground); upd.push((t) => ground.userData.update(-t));

  return {
    scene, camera, bloom: 1.0, exposure: 1.02,
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      // 摇臂上升 + 拉远
      camera.position.set(lerp(0.4, 1.8, e), lerp(-2.6, 7.2, e), lerp(6.0, 12.0, e));
      aim(camera, V3(0, lerp(1.0, 3.2, e), -14), lerp(0.06, -0.02, e));
      camera.fov = lerp(46, 34, e);
      camera.updateProjectionMatrix();
      camera.position.add(handheld(t, 0.02, 0.5));
    },
  };
}

/* ===================================================================
   7. 教室 —— 光柱与尘埃
   =================================================================== */
export function shotClassroom() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1920 / 804, 0.1, 120);
  const upd = [];

  // 窗外：灰白阴雨天光（不曝）
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec3 c = mix(vec3(0.40,0.44,0.46), vec3(0.72,0.73,0.70), smoothstep(0.0,0.85,vUv.y));
        // 远处树影/楼影（缓慢晃动）
        float t = fbm(vec2(vUv.x*3.2 + uTime*0.01, vUv.y*3.0));
        c *= 0.80 + 0.30*smoothstep(0.35,0.75,t);
        // 雨痕
        float rr = 0.0;
        for(int i=0;i<3;i++){
          float fi=float(i);
          float x = fract(vUv.x*(4.0+fi*3.0) + uTime*0.01);
          rr += smoothstep(0.004,0.0,abs(x-0.5));
        }
        c -= rr*0.06;
        gl_FragColor = vec4(c*0.86,1.0);
      }`,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(46, 22), skyMat);
  bg.position.set(0, 3.4, -12.2);
  scene.add(bg); upd.push((t) => { skyMat.uniforms.uTime.value = t; });

  const dark = new THREE.MeshBasicMaterial({ color: 0x02040a });
  // 窗框（粗、有厚度）
  for (let i = 0; i <= 4; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.6, 0.30), dark);
    v.position.set(-6.2 + i * 3.1, 3.2, -11.8); scene.add(v);
  }
  for (let j = 0; j <= 3; j++) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.20, 0.30), dark);
    h.position.set(0.0, 0.2 + j * 2.15, -11.8); scene.add(h);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.42, 0.6), dark);
  sill.position.set(0, 0.02, -11.6); scene.add(sill);
  // 左右墙
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 12), dark); wallL.position.set(-7.6, 4, -6);
  const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 12), dark); wallR.position.set(7.6, 4, -6);
  scene.add(wallL, wallR);

  // 光柱：从窗格射入（斜向拉长）
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 17), new THREE.MeshBasicMaterial({
      map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      color: 0xfff0d2, opacity: 0.18,
    }));
    m.position.set(-4.65 + i * 3.1, 2.4, -5.4);
    m.rotation.set(-0.72, 0, 0.05);
    scene.add(m);
  }

  // 课桌剪影
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.07, 0.66), dark);
      d.position.set(-4.5 + c * 3.05, 0.80, -3.0 + r * 2.1);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.8, 0.10), dark);
      leg.position.set(-4.5 + c * 3.05 + 0.42, 0.40, -3.0 + r * 2.1);
      const leg2 = leg.clone(); leg2.position.x -= 0.84;
      scene.add(d, leg, leg2);
    }
  }
  // 近景椅背
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.15, 0.10), dark);
  back.position.set(2.6, 0.98, 1.0); back.rotation.y = -0.28; back.rotation.x = -0.07;
  scene.add(back);

  const dust = createDust({ count: 1400, box: [16, 8, 14], size: 0.055, color: 0xffeccd, opacity: 0.85, seed: 5, rise: 0.05 });
  dust.position.set(0, 2.8, -5.5);
  scene.add(dust); upd.push((t) => dust.userData.update(t));

  return {
    scene, camera, bloom: 0.85, exposure: 0.95,
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      camera.position.set(lerp(1.0, 0.2, e), lerp(1.60, 1.46, e), lerp(6.8, 3.6, e));
      aim(camera, V3(-1.6, 2.4, -11.5), lerp(-0.012, 0.004, e));
      camera.position.add(handheld(t, 0.010, 0.55));
      camera.fov = lerp(34, 28, e);
      camera.updateProjectionMatrix();
    },
  };
}

/* ===================================================================
   8. 麦田 —— 逆光与风
   =================================================================== */
export function shotField() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1920 / 804, 0.1, 400);
  const upd = [];

  scene.add(createSkyDome({ top: 0x0b1a26, horizon: 0x4a4436, glow: 0x8f6a3e, glowDir: [0.12, 0.06, -1], glowAmt: 1.15, size: 260 }));

  // 夕阳圆盘 + 光晕
  const sunMat = new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffd9a0, opacity: 0.55,
  });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), sunMat);
  sun.position.set(26, 3.2, -190);
  scene.add(sun);

  const count = 34000;
  const rnd = rng(123);
  const g = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(0.017, 1.0, 1, 4);
  base.translate(0, 0.5, 0);
  g.setAttribute('position', base.attributes.position);
  g.setAttribute('uv', base.attributes.uv);
  g.setIndex(new THREE.BufferAttribute(base.index.array, 1));
  const off = new Float32Array(count * 3);
  const par = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.pow(rnd(), 0.75) * 62;
    const a = rnd() * Math.PI * 2;
    off[i * 3] = Math.cos(a) * r * 1.25;
    off[i * 3 + 1] = 0;
    off[i * 3 + 2] = Math.sin(a) * r - 6;
    par[i * 3] = 0.55 + rnd() * 0.95;
    par[i * 3 + 1] = rnd() * 6.28;
    par[i * 3 + 2] = 0.4 + rnd() * 0.9;
  }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
  g.setAttribute('aPar', new THREE.InstancedBufferAttribute(par, 3));
  g.instanceCount = count;

  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true, depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(26, 3.2, -190) },
      uDark: { value: new THREE.Color(0.030, 0.028, 0.024) },
      uGold: { value: new THREE.Color(1.0, 0.72, 0.34) },
    },
    vertexShader: `attribute vec3 aOff; attribute vec3 aPar;
      uniform float uTime; varying float vH; varying vec3 vW; varying float vSeed;
      void main(){
        vec3 p = position;
        float h = aPar.x;
        p.y *= h;
        float wind = sin(uTime*0.9 + aOff.x*0.10 + aOff.z*0.08) * 0.85
                   + sin(uTime*2.0 + aOff.x*0.33 + aPar.y) * 0.20;
        float k = pow(position.y, 1.7) / aPar.z;
        p.x += wind * k * 0.42;
        p.z += wind * k * 0.18;
        vec3 w = p + aOff;
        vW = w; vH = position.y; vSeed = aPar.y;
        gl_Position = projectionMatrix*viewMatrix*vec4(w,1.0);
      }`,
    fragmentShader: `uniform vec3 uDark,uGold,uSun; varying float vH; varying vec3 vW; varying float vSeed;
      void main(){
        vec3 toSun = normalize(uSun - vW);
        vec3 v = normalize(cameraPosition - vW);
        // 逆光：视线越接近太阳方向，边缘越亮
        float back = pow(max(0.0, dot(-v, toSun)), 1.6);
        float tip = smoothstep(0.45, 1.0, vH);
        float vary = 0.65 + 0.55*fract(vSeed*7.31);
        vec3 c = uDark;
        c += uGold * tip * (0.06 + back*0.62) * 0.80 * vary;
        c += uGold * back * 0.06 * smoothstep(0.0,0.5,vH);
        float d = length(vW - cameraPosition);
        c *= 1.0 - smoothstep(20.0, 58.0, d)*0.35;
        float a = smoothstep(0.0, 0.10, vH);
        a *= smoothstep(1.0, 3.4, d);          // 剔除贴脸的巨大叶片
        gl_FragColor = vec4(c, a);
      }`,
  });
  const field = new THREE.Mesh(g, mat);
  field.frustumCulled = false;
  scene.add(field);
  upd.push((t) => { mat.uniforms.uTime.value = t; });

  // 地平线暖雾
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(220, 34), new THREE.MeshBasicMaterial({
    map: texGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xd08c46, opacity: 0.22,
  }));
  haze.scale.set(1.6, 1.9, 1);
  haze.position.set(8, 7, -120);
  haze.material.opacity = 0.11;
  scene.add(haze);

  const rain = createRain({ count: 2600, area: [60, 30, 60], speed: [9, 15], len: [0.5, 1.5], width: 0.010, opacity: 0.22, seed: 8, color: 0xffe6c0 });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  return {
    scene, camera, bloom: 1.0, exposure: 1.02,
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      camera.position.set(lerp(-7, 3.0, e), lerp(1.42, 1.18, e), lerp(9.5, 5.2, e));
      aim(camera, V3(lerp(2.0, 4.0, e), lerp(2.6, 2.2, e), -60), lerp(0.02, 0, e));
      camera.position.add(handheld(t, 0.03, 1.1));
    },
  };
}

/* ===================================================================
   9. 反向彩虹 —— 天空的错误
   =================================================================== */
export function shotRainbow() {
  const uniforms = {
    uTime: { value: 0 }, uArc: { value: 0 }, uPan: { value: 0 }, uZoom: { value: 0 },
  };
  const { scene, camera } = fullscreenQuad({
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uTime, uArc, uPan, uZoom;
      varying vec2 vUv;

      vec3 sky(vec2 uv){
        vec2 p = vec2(uv.x + uPan, uv.y);
        vec3 top = vec3(0.055,0.085,0.125);
        vec3 mid = vec3(0.11,0.14,0.19);
        vec3 low = vec3(0.38,0.31,0.24);
        vec3 c = mix(mid, top, smoothstep(0.40,1.0,p.y));
        c = mix(c, low, smoothstep(0.42,0.02,p.y));
        // 云层
        float cl = fbm(vec2(p.x*3.2 + uTime*0.012, p.y*4.6));
        float cl2 = fbm(vec2(p.x*7.0 - uTime*0.02, p.y*9.0));
        float clouds = smoothstep(0.42,0.86, cl*0.75 + cl2*0.4);
        c = mix(c, mix(vec3(0.30,0.33,0.36), vec3(0.52,0.47,0.40), p.y), clouds*0.42);
        // 地平线以上的暗云带
        c *= 1.0 - smoothstep(0.30,0.0,p.y)*0.35;
        return c;
      }

      vec3 hsv2rgb(vec3 c){
        vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
        rgb = rgb*rgb*(3.0-2.0*rgb);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      void main(){
        vec2 uv = vUv;
        vec2 p = vec2((uv.x-0.5)*(1.0-uZoom*0.10)+0.5, uv.y);
        vec3 col = sky(p);

        // 低悬的太阳
        vec2 sunP = vec2(0.235 + uPan*0.6, 0.255);
        float sd = length((p-sunP)*vec2(1.0,1.05));
        col += vec3(1.0,0.70,0.40) * exp(-sd*9.0) * 0.34;
        col += vec3(1.0,0.90,0.72) * exp(-pow(sd/0.021,2.0)) * 0.85;

        // 倒置彩虹：圆心在画面上方，弧向下弯
        vec2 cen = vec2(0.50, 1.34);
        vec2 q = (p - cen) * vec2(1.0, 1.06);
        float r = length(q);
        float R = 0.82;
        float band = exp(-pow((r-R)/0.080, 2.0));
        float ang = atan(q.x, -q.y);          // 0 = 正下方
        float span = smoothstep(1.35, 0.35, abs(ang));   // 弧的可见范围
        float t = clamp((r-(R-0.088))/0.176, 0.0, 1.0);
        vec3 rb = hsv2rgb(vec3(mix(0.0, 0.75, t), 0.92, 1.0));
        float band2 = exp(-pow((r-(R+0.088))/0.042, 2.0)) * 0.20;
        vec3 rb2 = hsv2rgb(vec3(mix(0.22, 0.58, t), 0.55, 1.0));
        float grain = 0.50 + 0.80*fbm(vec2(ang*7.0, r*90.0) + uTime*0.15);
        col += (rb*band + rb2*band2) * span * grain * 0.40 * uArc;

        // 雨（屏幕空间斜线）
        float rain = 0.0;
        for(int i=0;i<3;i++){
          float fi = float(i);
          vec2 rp = vec2(p.x*(6.0+fi*4.0) + p.y*1.6, p.y*(2.2+fi*0.8) - uTime*(0.55+fi*0.2));
          rain += smoothstep(0.985, 1.0, vnoise(rp*vec2(40.0, 1.4)));
        }
        col += vec3(0.62,0.72,0.85) * rain * 0.10;

        gl_FragColor = vec4(col, 1.0);
      }`,
  }, uniforms);

  return {
    scene, camera, bloom: 0.55, exposure: 0.98, quad: true,
    update(t, dur) {
      const k = clamp(t / dur, 0, 1);
      uniforms.uTime.value = t;
      uniforms.uArc.value = smooth(Math.min(1, k * 2.2));
      uniforms.uPan.value = lerp(-0.05, 0.05, easeInOut(k));
      uniforms.uZoom.value = easeInOut(k);
    },
  };
}

/* ===================================================================
   10. 撑伞 —— 水珠炸开
   =================================================================== */
export function shotUmbrella() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1920 / 804, 0.05, 60);
  const upd = [];

  // 背景：极暗，几团柔光
  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec3 c = vec3(0.010,0.014,0.022);
        for(int i=0;i<8;i++){
          float fi=float(i);
          vec2 cp = vec2(hash21(vec2(fi*3.7,1.1)), hash21(vec2(fi*6.1,9.3)));
          vec2 d = (vUv-cp)*vec2(1.0,0.72);
          float r = 0.05 + hash21(vec2(fi,4.7))*0.10;
          float g = exp(-pow(length(d)/r, 2.4));
          vec3 lc = mix(vec3(1.0,0.56,0.24), vec3(0.30,0.55,0.85), step(0.60, hash21(vec2(fi,7.7))));
          c += lc*g*0.34;
        }
        c += vec3(0.35,0.24,0.12) * exp(-pow((vUv.y-0.30)*3.0,2.0)) * 0.35;
        gl_FragColor = vec4(c,1.0);
      }`,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(36, 22), bgMat);
  bg.position.set(0, 0.5, -9);
  scene.add(bg); upd.push((t) => { bgMat.uniforms.uTime.value = t; });

  // 伞（逆光轮廓 + 边缘光）
  const umb = new THREE.Group();
  const canopyMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
      void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz;
        vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz);
        gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime,uOpen; varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
      void main(){
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        vec3 base = vec3(0.022,0.026,0.036);
        // 伞面肋条
        float rib = pow(abs(sin(vUv.x*3.14159*8.0)), 10.0);
        vec3 col = base + vec3(1.0,0.80,0.55)*fres*0.62;
        col += vec3(0.55,0.62,0.75)*rib*fres*0.22;
        // 伞顶透光
        col += vec3(1.0,0.72,0.40)*pow(1.0-abs(vUv.y-0.15), 8.0)*0.10;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 48, 20, 0, Math.PI * 2, 0, Math.PI * 0.44),
    canopyMat
  );
  canopy.rotation.x = Math.PI;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.2, 8), new THREE.MeshBasicMaterial({ color: 0x0d1016 }));
  pole.position.y = -1.15;
  umb.add(canopy, pole);
  umb.position.set(0, 1.12, 0);
  umb.rotation.set(-0.20, 0.28, 0.05);
  scene.add(umb);

  // 伞后的暖光（把伞托起来）
  const backlight = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffa661, opacity: 0.34,
  }));
  backlight.position.set(0.22, 1.34, -2.6);
  scene.add(backlight);

  // 水珠飞散
  const N = 800;
  const pos = new Float32Array(N * 3);
  const dir = new Float32Array(N * 3);
  const siz = new Float32Array(N);
  const rnd = rng(404);
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.5);
    pos[i * 3] = Math.cos(a) * r * 0.98;
    pos[i * 3 + 1] = 0.02 * (rnd() - 0.5);
    pos[i * 3 + 2] = Math.sin(a) * r * 0.98;
    dir[i * 3] = Math.cos(a) * (0.7 + rnd() * 1.0);
    dir[i * 3 + 1] = 0.45 + rnd() * 0.95;
    dir[i * 3 + 2] = Math.sin(a) * (0.7 + rnd() * 1.0);
    siz[i] = 1.6 + rnd() * 4.4;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  pg.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
  const pmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 } },
    vertexShader: `attribute vec3 aDir; attribute float aSize;
      uniform float uT; varying float vA;
      void main(){
        float t = uT;
        vec3 p = position + aDir * (t*1.9) + vec3(0.0,-2.6*t*t,0.0);
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = clamp(aSize * 26.0 / max(d,0.001), 1.0, 26.0);
        vA = smoothstep(0.0,0.15,t) * (1.0 - smoothstep(0.7,1.6,t));
      }`,
    fragmentShader: `varying float vA;
      void main(){ vec2 q=gl_PointCoord-0.5; float a=smoothstep(0.5,0.05,length(q));
        gl_FragColor=vec4(vec3(0.82,0.90,1.0), a*vA*0.9); }`,
  });
  const pts = new THREE.Points(pg, pmat);
  pts.frustumCulled = false;
  umb.add(pts);

  const rain = createRain({ count: 2600, area: [22, 22, 22], speed: [10, 16], len: [0.5, 1.5], width: 0.010, opacity: 0.32, seed: 77, color: 0xcfe2ff });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  return {
    scene, camera, bloom: 1.0, exposure: 1.05,
    update(t, dur) {
      upd.forEach((f) => f(t));
      canopyMat.uniforms.uTime.value = t;
      pmat.uniforms.uT.value = Math.max(0, t - 0.22);
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      const open = smooth(clamp((t - 0.10) / 0.50, 0, 1));
      umb.scale.set(lerp(0.42, 1.0, open), lerp(0.60, 1.0, open), lerp(0.42, 1.0, open));
      umb.rotation.y = lerp(0.85, 0.26, open);
      umb.position.y = lerp(0.80, 1.12, open);
      backlight.material.opacity = 0.16 + 0.30 * open;
      camera.position.set(lerp(0.30, -0.34, e), lerp(0.30, 0.52, e), lerp(5.0, 3.0, e));
      aim(camera, V3(lerp(0, -0.05, e), lerp(1.06, 1.10, e), 0), 0.04);
      camera.position.add(handheld(t, 0.012, 0.8));
      camera.fov = lerp(32, 26, e);
      camera.updateProjectionMatrix();
    },
  };
}

/* ===================================================================
   11. 雨停 · 空站台（终镜）
   =================================================================== */
export function shotEmptyStation() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1920 / 804, 0.1, 400);
  const upd = [];

  scene.add(createSkyDome({ top: 0x03070f, horizon: 0x18293a, glow: 0x3a2a1c, glowDir: [0, 0.06, -1], glowAmt: 0.75, size: 300 }));

  const ground = createWetGround({ size: [140, 160], refl: 1.25, ripple: 0.35, intensity: 0.95, glowColor: new THREE.Color(0xffb066) });
  scene.add(ground); upd.push((t) => ground.userData.update(t * 0.25));

  const dark = new THREE.MeshBasicMaterial({ color: 0x030508 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 16), dark);
  roof.position.set(0, 4.4, -12); scene.add(roof);
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 4.4, 6), dark);
    c.position.set(-16 + i * 6.4, 2.2, -4.2); scene.add(c);
  }
  // 唯一一盏还亮着的灯
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe2b4 }));
  bulb.position.set(-8, 4.05, -8); scene.add(bulb);
  const cone = createLightCone({ color: 0xffa855, height: 5.6, rTop: 0.12, rBot: 3.2, opacity: 0.13 });
  cone.position.set(-8, 1.5, -8); scene.add(cone);
  upd.push((t) => cone.userData.update(t));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffa855, opacity: 0.5,
  }));
  glow.position.set(-8, 4.05, -8); scene.add(glow);

  // 立在站台中央的一把撑开的伞
  const stand = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.44),
    new THREE.MeshBasicMaterial({ color: 0x04060a, side: THREE.DoubleSide }));
  canopy.rotation.x = Math.PI; canopy.position.y = 1.02;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 1.05, 6), new THREE.MeshBasicMaterial({ color: 0x0a0d14 }));
  pole.position.y = 0.52;
  stand.add(canopy, pole);
  stand.position.set(0.75, 0, -5.4);
  stand.rotation.y = 0.62;
  stand.scale.setScalar(1.3);
  scene.add(stand);

  // 伞后的暖光
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffa661, opacity: 0.30,
  }));
  sb.position.set(0.75, 1.25, -6.3);
  scene.add(sb);

  // 悬浮的水珠（雨停在半空）
  const frozen = createDust({ count: 700, box: [26, 9, 26], size: 0.05, color: 0xd8ecff, opacity: 0.5, seed: 23, rise: 0.0 });
  frozen.position.set(0, 3.2, -6);
  scene.add(frozen); upd.push((t) => frozen.userData.update(t * 0.15));

  // 极少的雨
  const rain = createRain({ count: 700, area: [50, 26, 50], speed: [3, 6], len: [0.4, 1.0], width: 0.008, opacity: 0.14, seed: 101 });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  return {
    scene, camera, bloom: 1.02, exposure: 1.26,
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      // 极慢拉出 + 上升
      camera.position.set(lerp(-0.9, -0.1, e), lerp(1.00, 1.72, e), lerp(2.4, 9.2, e));
      aim(camera, V3(lerp(0.75, 0.62, e), lerp(1.05, 1.35, e), -5.8), lerp(0.008, 0, e));
      camera.position.add(handheld(t, 0.006, 0.35));
      camera.fov = lerp(32, 40, e);
      camera.updateProjectionMatrix();
    },
  };
}

/* ===================================================================
   12. 纯黑字卡场景（弱雨）
   =================================================================== */
export function shotVoid(opt = {}) {
  const { rain = 0.25 } = opt;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1920 / 804, 0.1, 200);
  camera.position.set(0, 0, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(60, 30), mat));
  const r = createRain({ count: Math.round(1200 * rain), area: [26, 20, 20], speed: [4, 9], len: [0.4, 1.2], width: 0.008, opacity: 0.16, seed: 303, color: 0x9fc4e8 });
  scene.add(r);
  return {
    scene, camera, bloom: 0.35, exposure: 1.0,
    update(t) { r.userData.update(t); },
  };
}
