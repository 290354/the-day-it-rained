import * as THREE from 'three';
import { rng, lerp, GLSL_NOISE, texBokeh, texGlow } from './lib.js';
import { litMaterial } from './lighting.js';

/* ============================================================
   共用：带方向性轮廓光的暗部材质
   ============================================================ */
export function rimMaterial(color = 0x02030a, rimColor = 0xffb173, amt = 0.42) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uCol: { value: new THREE.Color(color) },
      uRim: { value: new THREE.Color(rimColor) },
      uRimAmt: { value: amt },
      uL: { value: new THREE.Vector3(-0.28, 0.82, -1.0).normalize() },
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
        float rim = pow(f, 3.2) * pow(lam, 1.5);
        gl_FragColor = vec4(uCol + uRim * rim * uRimAmt, 1.0);
      }`,
  });
}

/* ============================================================
   雨伞
   ============================================================ */
export function createUmbrella(opts = {}) {
  const { radius = 0.55, color = 0x05070d, ribs = 10, rim = 0xffc08a, amt = 0.55 } = opts;
  const g = new THREE.Group();
  const sag = radius * 0.30;
  const canopyMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uCol: { value: new THREE.Color(color) },
      uRim: { value: new THREE.Color(rim) },
      uRibs: { value: ribs },
      uL: { value: new THREE.Vector3(-0.15, 0.95, -0.6).normalize() },
    },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0);
        vN=normalize(mat3(modelMatrix)*normal);
        vV=normalize(cameraPosition-w.xyz);
        gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCol,uRim,uL; uniform float uRibs;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){
        vec3 N = normalize(vN);
        float f = 1.0 - abs(dot(N, normalize(vV)));
        float up = clamp(dot(N, normalize(uL)), 0.0, 1.0);
        // 伞面被上方灯光打亮的渐变
        float top = pow(up, 1.4) * (0.22 + 0.75 * pow(f, 1.5));
        // 伞骨阴影（8 条肋）
        float ribId = abs(fract(vUv.x * uRibs) - 0.5) * 2.0;
        float rib = smoothstep(0.86, 1.0, ribId);
        // 伞边透光
        float edge = smoothstep(0.55, 1.0, vUv.y);
        vec3 c = uCol + uRim * (top * 0.85 + edge * 0.18);
        c *= 1.0 - rib * 0.35;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 10, 0, Math.PI * 2, 0, Math.PI * 0.40),
    canopyMat
  );
  canopy.position.y = sag;
  canopy.scale.y = 0.62;
  g.add(canopy);
  // 伞骨末端
  const ribMat = new THREE.MeshBasicMaterial({ color: 0x0b0e14 });
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, radius * 0.99, 3), ribMat);
    r.position.set(Math.cos(a) * radius * 0.48, sag * 0.5, Math.sin(a) * radius * 0.48);
    r.rotation.z = Math.cos(a) * 0.95;
    r.rotation.x = -Math.sin(a) * 0.95;
    g.add(r);
  }
  // 伞杆 + 弯把
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, radius * 1.9, 6),
    new THREE.MeshBasicMaterial({ color: 0x14181f }));
  shaft.position.y = -radius * 0.94;
  g.add(shaft);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 12, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x14181f }));
  hook.position.set(0.045, -radius * 1.88, 0);
  hook.rotation.z = Math.PI;
  g.add(hook);
  return g;
}

/* ============================================================
   人（真实比例 + 姿态）
   ============================================================ */
export function createPerson(opts = {}) {
  const {
    height = 1.72, color = 0x02030a, rim = 0xffb173, rimAmt = 0.42,
    pose = 'stand', coat = false, umbrella = null, faceDir = 1,
    carryingBag = false,
  } = opts;

  const H = height;
  const g = new THREE.Group();
  const mat = rimMaterial(color, rim, rimAmt);
  const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    g.add(m);
    return m;
  };

  const shoulderY = H * 0.815;
  const hipY = H * 0.505;

  // 髋 / 腰
  add(new THREE.CylinderGeometry(H * 0.088, H * 0.082, H * 0.10, 12), 0, hipY, 0, 0, 0, 0, 1, 1, 0.72);
  // 躯干（肩宽腰细）
  add(new THREE.CylinderGeometry(H * 0.118, H * 0.086, H * 0.27, 14), 0, H * 0.665, 0, 0, 0, 0, 1, 1, 0.74);
  // 肩带
  add(new THREE.SphereGeometry(H * 0.118, 14, 10), 0, shoulderY - H * 0.012, 0, 0, 0, 0, 1, 0.52, 0.72);
  // 颈
  add(new THREE.CylinderGeometry(H * 0.030, H * 0.034, H * 0.05, 8), 0, H * 0.845, 0);
  // 头
  add(new THREE.SphereGeometry(H * 0.061, 16, 12), 0, H * 0.902, 0, 0, 0, 0, 0.94, 1.08, 0.96);
  // 头发（包住上半与后脑）
  add(new THREE.SphereGeometry(H * 0.064, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    0, H * 0.918, -H * 0.004, 0.12, 0, 0, 0.96, 0.92, 1.0);
  // 大衣下摆
  if (coat) {
    add(new THREE.CylinderGeometry(H * 0.098, H * 0.132, H * 0.30, 14, 1, true), 0, H * 0.40, 0, 0, 0, 0, 1, 1, 0.8);
  }

  // 腿
  const legLen = H * 0.47;
  const swing = pose === 'walk' ? 0.16 : 0;
  const legGeo = new THREE.CylinderGeometry(H * 0.058, H * 0.044, legLen, 10);
  const lL = add(legGeo, -H * 0.050, legLen * 0.5, 0, swing, 0, 0.02);
  const lR = add(legGeo, H * 0.050, legLen * 0.5, 0, -swing, 0, -0.02);
  // 鞋
  const shoeGeo = new THREE.BoxGeometry(H * 0.072, H * 0.036, H * 0.13);
  add(shoeGeo, -H * 0.050, H * 0.018, H * 0.020 + swing * 0.2, 0, 0, 0.02);
  add(shoeGeo, H * 0.050, H * 0.018, H * 0.020 - swing * 0.2, 0, 0, -0.02);

  // 手臂
  const armGeo = new THREE.CapsuleGeometry(H * 0.026, H * 0.155, 4, 8);
  const foreGeo = new THREE.CapsuleGeometry(H * 0.022, H * 0.145, 4, 8);
  // 左臂（自然下垂）
  add(armGeo, -H * 0.128, H * 0.72, 0, 0, 0, 0.10);
  add(foreGeo, -H * 0.148, H * 0.575, H * 0.008, -0.10, 0, 0.05);
  // 右臂：握伞（上臂前抬，前臂竖起）
  if (umbrella) {
    add(armGeo, H * 0.132, H * 0.725, H * 0.020, 0.55, 0, -0.18);
    add(foreGeo, H * 0.150, H * 0.665, H * 0.150, 1.15, 0, -0.10);
    add(new THREE.SphereGeometry(H * 0.026, 8, 6), H * 0.152, H * 0.720, H * 0.215);
  } else {
    add(armGeo, H * 0.128, H * 0.72, 0, 0, 0, -0.10);
    add(foreGeo, H * 0.148, H * 0.575, H * 0.008, -0.06, 0, -0.05);
  }

  g.userData.material = mat;
  g.userData.height = H;

  if (umbrella) {
    const um = createUmbrella({ radius: H * 0.34, ...umbrella });
    um.position.set(H * 0.152, H * 0.735, H * 0.215);
    um.rotation.set(0.06, 0, -0.05);
    g.add(um);
    g.userData.umbrella = um;
  }

  return g;
}

/* ============================================================
   canvas 招牌
   ============================================================ */
export function signTexture(draw, w = 512, h = 256) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function neonSign(text, color, sub) {
  return signTexture((g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 34;
    g.fillStyle = color;
    g.font = `bold ${Math.round(h * 0.46)}px "Microsoft YaHei", sans-serif`;
    g.fillText(text, w / 2, h * 0.42);
    if (sub) {
      g.shadowBlur = 16;
      g.font = `${Math.round(h * 0.14)}px "Bahnschrift", sans-serif`;
      g.fillStyle = color;
      g.globalAlpha = 0.8;
      g.fillText(sub, w / 2, h * 0.78);
    }
    g.shadowBlur = 6; g.fillStyle = '#ffffff'; g.globalAlpha = 0.75;
    g.font = `bold ${Math.round(h * 0.46)}px "Microsoft YaHei", sans-serif`;
    g.fillText(text, w / 2, h * 0.42);
  });
}

/* ============================================================
   路灯
   ============================================================ */
export function createStreetLamp(opts = {}) {
  const { height = 6.2, warm = 0xffa855, cone = false, double = false } = opts;
  const g = new THREE.Group();
  const metal = new THREE.MeshBasicMaterial({ color: 0x0a0e14 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, height, 10), metal);
  pole.position.y = height / 2;
  g.add(pole);
  const arms = double ? [1, -1] : [1];
  for (const s of arms) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), metal);
    arm.rotation.z = Math.PI / 2 - s * 0.22;
    arm.position.set(s * 0.72, height - 0.10, 0);
    g.add(arm);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.13, 0.16, 12), metal);
    head.position.set(s * 1.42, height - 0.24, 0);
    g.add(head);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff0d6 }));
    bulb.position.set(s * 1.42, height - 0.32, 0);
    g.add(bulb);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({
      map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, color: warm, opacity: 0.26,
    }));
    glow.position.copy(bulb.position);
    g.add(glow);
    if (cone) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 3.0, height - 0.5, 20, 1, true),
        new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          uniforms: { uC: { value: new THREE.Color(warm) }, uT: { value: 0 } },
          vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
            void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0);
              vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz);
              gl_Position=projectionMatrix*viewMatrix*w; }`,
          fragmentShader: `uniform vec3 uC; uniform float uT;
            varying vec2 vUv; varying vec3 vN; varying vec3 vV;
            void main(){
              float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
              float fall = smoothstep(1.0, 0.05, vUv.y);
              float flick = 0.9 + 0.1*sin(uT*6.0 + vUv.y*8.0);
              gl_FragColor = vec4(uC, 0.10 * fres * fall * fall * flick);
            }`,
        }));
      c.position.set(s * 1.42, (height - 0.5) / 2, 0);
      g.add(c);
      g.userData.cone = c;
    }
  }
  g.userData.update = (t) => {
    if (g.userData.cone) g.userData.cone.material.uniforms.uT.value = t;
  };
  return g;
}

/* ============================================================
   公交候车亭（玻璃 + 灯箱 + 顶棚 + 立柱）
   ============================================================ */
export function createShelter(opts = {}) {
  const { w = 5.4, d = 1.7, h = 2.55, adText = '雨', adColor = '#5fd0ff' } = opts;
  const g = new THREE.Group();
  const metal = new THREE.MeshBasicMaterial({ color: 0x0a0f16 });

  // 顶棚
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, d), metal);
  roof.position.y = h;
  g.add(roof);
  const roofEdge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.13, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x1a2430 }));
  roofEdge.position.set(0, h - 0.02, d / 2);
  g.add(roofEdge);

  // 立柱
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, h, 8), metal);
    p.position.set(sx * (w / 2 - 0.10), h / 2, sz * (d / 2 - 0.10));
    g.add(p);
  }

  // 背板玻璃（半透 + 雨痕）
  const glassMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uT; varying vec2 vUv;
      void main(){
        float streaks = 0.0;
        for(int i=0;i<9;i++){
          float fi=float(i);
          float x = hash21(vec2(fi*3.1, 7.7));
          float w = 0.004 + hash21(vec2(fi,2.2))*0.010;
          float y0 = fract(uT*0.05 + fi*0.31);
          float b = smoothstep(w,0.0,abs(vUv.x-x));
          b *= smoothstep(y0-0.5,y0-0.05,vUv.y)*smoothstep(y0+0.06,y0,vUv.y);
          streaks += b;
        }
        vec3 c = vec3(0.06,0.09,0.12) + vec3(0.35,0.45,0.55)*streaks*0.35;
        float a = 0.16 + 0.10*streaks;
        // 边框
        float edgeX = smoothstep(0.02,0.0,min(vUv.x,1.0-vUv.x));
        float edgeY = smoothstep(0.03,0.0,min(vUv.y,1.0-vUv.y));
        c += vec3(0.10,0.13,0.17)*(edgeX+edgeY);
        a += (edgeX+edgeY)*0.35;
        gl_FragColor = vec4(c, a);
      }`,
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, h - 0.18), glassMat);
  back.position.set(0, h / 2, -d / 2 + 0.06);
  g.add(back);
  g.userData.glass = glassMat;

  // 侧面玻璃
  for (const sx of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(d - 0.18, h - 0.18), glassMat);
    s.position.set(sx * (w / 2 - 0.08), h / 2, 0);
    s.rotation.y = Math.PI / 2;
    g.add(s);
  }

  // 广告灯箱（侧板）
  const adTex = signTexture((c, cw, ch) => {
    c.fillStyle = '#08131a'; c.fillRect(0, 0, cw, ch);
    const grd = c.createLinearGradient(0, 0, cw, ch);
    grd.addColorStop(0, 'rgba(30,90,130,0.9)');
    grd.addColorStop(1, 'rgba(10,30,50,0.9)');
    c.fillStyle = grd; c.fillRect(0, 0, cw, ch);
    c.strokeStyle = 'rgba(160,220,255,0.35)'; c.lineWidth = 4; c.strokeRect(12, 12, cw - 24, ch - 24);
    c.fillStyle = adColor;
    c.font = 'bold 130px "Microsoft YaHei", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = adColor; c.shadowBlur = 30;
    c.fillText(adText, cw / 2, ch * 0.44);
    c.shadowBlur = 0;
    c.font = '20px "Bahnschrift", sans-serif';
    c.fillStyle = 'rgba(190,225,245,0.65)';
    c.fillText('STAY DRY · 记得带伞', cw / 2, ch * 0.80);
  }, 512, 768);
  const ad = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.55),
    new THREE.MeshBasicMaterial({ map: adTex, transparent: true, opacity: 0.95 }));
  ad.position.set(w / 2 - 0.09, h * 0.52, 0);
  ad.rotation.y = -Math.PI / 2;
  g.add(ad);
  const adGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, color: 0x6fc4ff, opacity: 0.22,
  }));
  adGlow.position.set(w / 2 - 0.12, h * 0.52, 0);
  adGlow.rotation.y = -Math.PI / 2;
  g.add(adGlow);

  // 顶部灯带
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 0.10), new THREE.MeshBasicMaterial({
    color: 0xcfe6ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  strip.rotation.x = Math.PI / 2;
  strip.position.set(0, h - 0.06, 0);
  g.add(strip);

  return g;
}

/* ============================================================
   公交站牌柱（圆杆 + 顶部线路牌）
   ============================================================ */
export function createStopSign(opts = {}) {
  const { name = '环城西路', en = 'HUANCHENG WEST RD.', color = '#7fc4f0', num = '07' } = opts;
  const g = new THREE.Group();
  const metal = new THREE.MeshBasicMaterial({ color: 0x0d1319 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.7, 8), metal);
  pole.position.y = 1.35;
  g.add(pole);

  const tex = signTexture((c, w, h) => {
    c.fillStyle = '#081119'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(150,190,215,0.30)'; c.lineWidth = 3; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#e9f0f6';
    c.font = '600 78px "Microsoft YaHei", sans-serif';
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(name, 44, h * 0.38);
    c.fillStyle = 'rgba(180,205,222,0.62)';
    c.font = '26px "Bahnschrift", sans-serif';
    c.fillText(en, 46, h * 0.72);
    c.fillStyle = '#2b7cae'; c.fillRect(w - 190, 34, 150, 48);
    c.fillStyle = '#e6f2fa'; c.font = 'bold 34px "Bahnschrift", sans-serif';
    c.textAlign = 'center'; c.fillText(num, w - 115, 60);
  }, 768, 200);

  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.43),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  board.position.set(0.40, 2.42, 0);
  g.add(board);
  const board2 = board.clone();
  board2.rotation.y = Math.PI;
  board2.position.set(0.40, 2.42, -0.001);
  g.add(board2);

  // 牌面背光
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.9), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, color: 0x9fd0ff, opacity: 0.16,
  }));
  glow.position.set(0.40, 2.42, -0.02);
  g.add(glow);

  // 时刻表小牌
  const t2 = signTexture((c, w, h) => {
    c.fillStyle = '#060d12'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(200,220,235,0.85)';
    c.font = 'bold 22px "Bahnschrift", sans-serif';
    c.fillText('LAST  TRAIN', 26, 46);
    for (let i = 0; i < 9; i++) {
      c.fillStyle = `rgba(190,215,232,${0.22 - i * 0.015})`;
      c.fillRect(26, 76 + i * 34, 110 + (i % 3) * 30, 4);
    }
  }, 256, 420);
  const t2m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.68),
    new THREE.MeshBasicMaterial({ map: t2, transparent: true, opacity: 0.85 }));
  t2m.position.set(0.0, 1.72, 0.05);
  g.add(t2m);

  g.userData.glassTex = t2;
  return g;
}

/* ============================================================
   站台家具：长椅 / 垃圾桶 / 护栏
   ============================================================ */
export function createBench(opts = {}) {
  const { len = 2.2 } = opts;
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0x0a0f15 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.42), m);
  seat.position.y = 0.44; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(len, 0.30, 0.05), m);
  back.position.set(0, 0.64, -0.20); g.add(back);
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.42), m);
    slat.position.set(0, 0.44 + 0.06 + i * 0.001, 0); g.add(slat);
  }
  for (const dx of [-len / 2 + 0.14, len / 2 - 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.34), m);
    leg.position.set(dx, 0.22, 0); g.add(leg);
  }
  return g;
}

export function createBin(opts = {}) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0x0a1016 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.78, 12), m);
  body.position.y = 0.39; g.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.05, 12), m);
  lid.position.y = 0.80; g.add(lid);
  return g;
}

export function createRailing(opts = {}) {
  const { len = 20, h = 1.05, posts = 12 } = opts;
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0x0b1017 });
  for (let i = 0; i < posts; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, h, 6), m);
    p.position.set(-len / 2 + (len / (posts - 1)) * i, h / 2, 0);
    g.add(p);
  }
  for (const y of [h, h * 0.58]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, len, 6), m);
    r.rotation.z = Math.PI / 2;
    r.position.set(0, y, 0);
    g.add(r);
  }
  return g;
}

/* ============================================================
   公交车（外形）
   ============================================================ */
export function createBus(opts = {}) {
  const { len = 10.5, w = 2.5, h = 3.0, route = '07', dest = '环城西路' } = opts;
  const g = new THREE.Group();
  const bodyMat = new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(0x0a1018) },
      uRim: { value: new THREE.Color(0x6fb0d8) },
    },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz;
        vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz);
        gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uBase,uRim; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        vec3 N=normalize(vN); vec3 V=normalize(vV);
        float fres = pow(1.0-abs(dot(N,V)), 2.4);
        float top = smoothstep(2.2, 3.4, vW.y);
        vec3 c = uBase + uRim*(fres*0.30 + top*0.10);
        gl_FragColor = vec4(c,1.0);
      }`,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), bodyMat);
  body.position.y = h / 2 + 0.34;
  g.add(body);
  // 腰线
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.10, len - 0.05),
    new THREE.MeshBasicMaterial({ color: 0x2b7cae }));
  stripe.position.y = h * 0.42;
  g.add(stripe);
  // 车窗带
  const winMat = new THREE.MeshBasicMaterial({ color: 0x0b1620 });
  for (const s of [1, -1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.95, len - 1.6), winMat);
    win.position.set(s * (w / 2 + 0.001), h * 0.72, 0);
    g.add(win);
  }
  // 车轮
  const wheelMat = new THREE.MeshBasicMaterial({ color: 0x04060a });
  for (const z of [-len * 0.30, len * 0.30]) {
    for (const s of [1, -1]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.24, 16), wheelMat);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(s * (w / 2 - 0.06), 0.52, z);
      g.add(wh);
    }
  }
  // 前脸灯
  for (const s of [1, -1]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2d8 }));
    hl.position.set(s * 0.85, 0.92, len / 2 + 0.01);
    g.add(hl);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({
      map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, color: 0xffd9a0, opacity: 0.55,
    }));
    glow.position.set(s * 0.85, 0.92, len / 2 + 0.05);
    g.add(glow);
  }
  // 路牌
  const rt = signTexture((c, cw, ch) => {
    c.fillStyle = '#080f14'; c.fillRect(0, 0, cw, ch);
    c.fillStyle = '#ffb020'; c.fillRect(6, 6, 84, ch - 12);
    c.fillStyle = '#101619'; c.font = 'bold 64px "Bahnschrift", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(route, 48, ch / 2);
    c.fillStyle = '#e8f0f6'; c.font = 'bold 52px "Microsoft YaHei", sans-serif';
    c.textAlign = 'left';
    c.fillText(dest, 108, ch / 2);
  }, 512, 96);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.36),
    new THREE.MeshBasicMaterial({ map: rt, transparent: true }));
  sign.position.set(0, h * 0.90, len / 2 + 0.02);
  g.add(sign);
  return g;
}

/* ============================================================
   公交车内部
   ============================================================ */
export function createBusInterior(opts = {}) {
  const { len = 11, w = 2.45, h = 2.35 } = opts;
  const g = new THREE.Group();
  const dark = litMaterial(0x161c24, { spec: 0.18, shininess: 26 });

  // 地板
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, len), litMaterial(0x2a2f36, { spec: 0.55, shininess: 30 }));
  floor.position.y = 0; g.add(floor);
  // 顶
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, len), dark);
  ceil.position.y = h; g.add(ceil);
  // 顶灯
  for (let i = 0; i < 3; i++) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 2.3), new THREE.MeshBasicMaterial({
      color: 0xdfe9f2, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    panel.rotation.x = Math.PI / 2;
    panel.rotation.z = Math.PI / 2;
    panel.position.set(0, h - 0.05, -3.6 + i * 3.4);
    g.add(panel);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.0), new THREE.MeshBasicMaterial({
      map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, color: 0xffe3b8, opacity: 0.12,
    }));
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, h - 0.12, -3.6 + i * 3.4);
    g.add(glow);
  }
  // 侧壁
  for (const s of [1, -1]) {
    const wallLow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, len), dark);
    wallLow.position.set(s * w / 2, 0.525, 0);
    g.add(wallLow);
    const wallHigh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.30, len), dark);
    wallHigh.position.set(s * w / 2, h - 0.15, 0);
    g.add(wallHigh);
    // 座椅（两条长凳）
    for (let i = 0; i < 5; i++) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.10, 0.95), litMaterial(0x2c3644, { spec: 0.30, shininess: 34 }));
      seat.position.set(s * (w / 2 - 0.32), 0.46, -3.4 + i * 1.5);
      g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.55, 0.95), litMaterial(0x1d2632, { spec: 0.22, shininess: 28 }));
      back.position.set(s * (w / 2 - 0.08), 0.74, -3.4 + i * 1.5);
      g.add(back);
    }
  }
  // 立柱 + 横杆 + 吊环
  for (const z of [-4.2, 0.1, 4.2]) {
    for (const s of [1, -1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, h, 8),
        litMaterial(0x59636f, { spec: 0.7, shininess: 64 }));
      pole.position.set(s * (w / 2 - 0.42), h / 2, z);
      g.add(pole);
    }
  }
  for (const s of [1, -1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, len - 1.2, 8),
      litMaterial(0x59636f, { spec: 0.7, shininess: 64 }));
    rail.rotation.x = Math.PI / 2;
    rail.position.set(s * (w / 2 - 0.42), h - 0.42, 0);
    g.add(rail);
    for (let i = 0; i < 9; i++) {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.010, 5, 10),
        new THREE.MeshBasicMaterial({ color: 0x1b232d }));
      strap.position.set(s * (w / 2 - 0.42), h - 0.54, -4.6 + i * 1.15);
      strap.rotation.y = Math.PI / 2;
      g.add(strap);
    }
  }
  // 前部挡板
  const front = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.10), dark);
  front.position.set(0, h / 2, -len / 2 + 0.05);
  g.add(front);
  return g;
}
