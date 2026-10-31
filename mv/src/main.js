import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { TIMELINE, STAMPS, ROLL, TRANSITIONS, DURATION } from './timeline.js';
import * as SHOTS from './shots.js';
import * as SCENES from './scenes.js';

const FACTORY = { ...SHOTS, ...SCENES };

const W = 1920, H = 804;

/* ---------------- renderer ---------------- */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: false,
  preserveDrawingBuffer: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = false;
renderer.autoClear = true;

/* ---------------- 全屏 pass 基础设施 ---------------- */
const quadScene = new THREE.Scene();
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadGeo = new THREE.PlaneGeometry(2, 2);
const quadMesh = new THREE.Mesh(quadGeo, new THREE.MeshBasicMaterial());
quadMesh.frustumCulled = false;
quadScene.add(quadMesh);

function fsPass(mat, target) {
  quadMesh.material = mat;
  renderer.setRenderTarget(target || null);
  renderer.render(quadScene, quadCam);
}

const sceneRT = new THREE.WebGLRenderTarget(W, H, {
  type: THREE.HalfFloatType,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  depthBuffer: true,
  stencilBuffer: false,
});
const depthTex = new THREE.DepthTexture(W, H);
depthTex.type = THREE.FloatType;
sceneRT.depthTexture = depthTex;

const dofRT = new THREE.WebGLRenderTarget(W, H, {
  type: THREE.HalfFloatType,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  depthBuffer: false,
  stencilBuffer: false,
});

/* ---------------- 景深（CoC 散景） ---------------- */
const dofMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: {
    tDiffuse: { value: sceneRT.texture },
    tDepth: { value: depthTex },
    uNear: { value: 0.1 }, uFar: { value: 400 },
    uFocus: { value: 10 }, uAperture: { value: 0.7 }, uMaxBlur: { value: 12 },
    uRes: { value: new THREE.Vector2(W, H) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform float uNear, uFar, uFocus, uAperture, uMaxBlur;
    uniform vec2 uRes;
    varying vec2 vUv;

    float linearDepth(vec2 uv){
      float z = texture2D(tDepth, uv).x;
      float ndc = z * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
    }

    void main(){
      vec2 uv = vUv;
      vec3 col = texture2D(tDiffuse, uv).rgb;
      float dz = linearDepth(uv);
      float coc = clamp(abs(dz - uFocus) / max(uFocus, 0.001) * uAperture, 0.0, 1.0);
      float rad = coc * uMaxBlur;
      if (rad > 0.6) {
        vec3 sum = col;
        float wsum = 1.0;
        for (int i = 0; i < 16; i++) {
          float fi = float(i);
          float ang = fi * 2.39996323 + 0.85;
          float rr = sqrt((fi + 0.5) / 16.0) * rad;
          vec2 off = vec2(cos(ang), sin(ang)) * rr / uRes;
          float d2 = linearDepth(uv + off);
          float w = (d2 < dz - 0.45) ? 0.25 : 1.0;
          sum += texture2D(tDiffuse, uv + off).rgb * w;
          wsum += w;
        }
        col = sum / wsum;
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
});

const copyMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: { tDiffuse: { value: sceneRT.texture } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }`,
});

/* ---------------- 最终调色 ---------------- */
const finalMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: {
    tDiffuse: { value: dofRT.texture },
    uTime: { value: 0 },
    uGrain: { value: 0.055 },
    uCA: { value: 0.0016 },
    uVig: { value: 0.30 },
    uExp: { value: 1.0 },
    uFlicker: { value: 0.012 },
    uWeave: { value: 1.0 },
    uSat: { value: 1.0 },
    uLift: { value: new THREE.Vector3(0.011, 0.014, 0.022) },
    uWarm: { value: 0.06 },
    uRes: { value: new THREE.Vector2(W, H) },
    uStreak: { value: 0.10 },
    uStreakTint: { value: new THREE.Color(0x7fa8ff) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uCA, uVig, uExp, uFlicker, uWeave, uSat, uWarm;
    uniform vec3 uLift; uniform vec2 uRes;
    uniform float uStreak; uniform vec3 uStreakTint;
    varying vec2 vUv;

    float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p,p+19.19); return fract(p.x*p.y); }

    void main(){
      vec2 uv = vUv;
      float wv = uWeave * 0.00028;
      uv.x += sin(uTime*1.7 + 0.6) * wv + sin(uTime*6.3) * wv*0.4;
      uv.y += cos(uTime*1.3 + 1.9) * wv + cos(uTime*5.1) * wv*0.35;

      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      float ca = uCA * (0.35 + r2*2.6);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d*ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d*ca).b;

      vec3 streak = vec3(0.0);
      for(int i=1;i<=9;i++){
        float fi = float(i);
        vec2 o = vec2(fi*4.6/uRes.x, 0.0);
        vec3 a = texture2D(tDiffuse, uv + o).rgb;
        vec3 b = texture2D(tDiffuse, uv - o).rgb;
        float la = max(max(a.r,a.g),a.b);
        float lb = max(max(b.r,b.g),b.b);
        streak += (a*smoothstep(0.68,1.05,la) + b*smoothstep(0.68,1.05,lb)) * (1.0 - fi/10.5);
      }
      col += streak * uStreakTint * uStreak;

      float fl = 1.0 - uFlicker * 0.5 + uFlicker * hash(vec2(floor(uTime*24.0), 3.7));
      col *= uExp * fl;

      float lum = dot(col, vec3(0.2126,0.7152,0.0722));
      col = mix(vec3(lum), col, uSat);
      col += uLift;
      col = mix(col, col*vec3(1.06,0.995,0.90), uWarm);
      col = mix(col, col*vec3(0.92,1.00,1.08), smoothstep(0.45,0.0,lum)*0.55);

      vec3 over = max(vec3(0.0), col - 0.80);
      col = col - over + over / (1.0 + over * 0.85);

      float vig = smoothstep(1.24, 0.18, length(d*vec2(1.0,1.18))*1.42);
      col *= mix(1.0 - uVig, 1.0, vig);

      float g = hash(uv*uRes + uTime*97.31) - 0.5;
      float g2 = hash(uv*uRes*1.7 - uTime*53.7) - 0.5;
      col += (g*0.7 + g2*0.3) * uGrain * (1.35 - lum*0.85);

      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }`,
});

const bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.66, 0.70);
bloomPass.renderToScreen = false;

/* ---------------- 镜头缓存 ---------------- */
const cache = new Map();
let activeShot = null;

const DOF_DEFAULT = {
  shotCloudDive: { focus: 95, aperture: 0.32, max: 9 },
  shotStation: { focus: 7.2, aperture: 0.62, max: 14 },
  shotBus: { focus: 4.2, aperture: 0.55, max: 13 },
  shotPuddle: { focus: 8.5, aperture: 0.60, max: 15 },
  shotRainReverse: { focus: 13, aperture: 0.50, max: 12 },
  shotClassroom: { focus: 11, aperture: 0.55, max: 13 },
  shotField: { focus: 16, aperture: 0.45, max: 12 },
  shotRainbow: { focus: 320, aperture: 0.18, max: 7 },
  shotUmbrella: { focus: 3.4, aperture: 0.32, max: 11 },
  shotEmptyStation: { focus: 6.0, aperture: 0.58, max: 14 },
  shotVoid: { focus: 10, aperture: 0.20, max: 6 },
};

function getShot(entry) {
  if (cache.has(entry.id)) return cache.get(entry.id);
  const f = FACTORY[entry.factory];
  if (!f) throw new Error('unknown factory: ' + entry.factory);
  const s = f(entry.opts || {});
  s._factory = entry.factory;
  cache.set(entry.id, s);
  return s;
}

function applyShotParams(shot, entry) {
  const dp = shot.dof ?? DOF_DEFAULT[shot._factory] ?? { focus: 10, aperture: 0.6, max: 10 };
  dofMat.uniforms.uNear.value = shot.camera.near ?? 0.1;
  dofMat.uniforms.uFar.value = shot.camera.far ?? 400;
  dofMat.uniforms.uFocus.value = dp.focus;
  dofMat.uniforms.uAperture.value = dp.aperture;
  dofMat.uniforms.uMaxBlur.value = dp.max;
  bloomPass.strength = (shot.bloom ?? 0.8) * (entry.bloomScale ?? 1);
  renderer.toneMappingExposure = shot.exposure ?? 1.0;
}

/* ---------------- 字幕 ---------------- */
const cardEl = document.getElementById('card');
const stampEl = document.getElementById('stamp');
const rollEl = document.getElementById('roll');
const fadeEl = document.getElementById('fade');

function renderCard(card, p) {
  if (!card) { cardEl.innerHTML = ''; cardEl.style.opacity = 0; return; }
  const inK = Math.min(1, p / 0.16);
  const outK = Math.min(1, (1 - p) / 0.20);
  const a = Math.min(inK, outK);
  const op = a * a * (3 - 2 * a);
  const rise = (1 - Math.min(1, p / 0.22)) * 14;

  let html = '';
  const enCls = card.kind === 'title' ? 'title-en' : card.kind === 'narr' ? 'narr-en'
    : card.kind === 'lyric' ? 'lyric-en' : 'brand-en';
  const en = card.en ? `<div class="en ${enCls}">${card.en}</div>` : '';

  if (card.kind === 'title') {
    html = `<div class="card-inner"><div class="cn title-cn">${card.cn}</div>${en}</div>`;
  } else if (card.kind === 'brand') {
    html = `<div class="card-inner"><div class="cn brand-cn">${card.cn}</div>${en}</div>`;
  } else if (card.kind === 'narr') {
    html = `<div class="card-inner"><div class="hair"></div><div class="cn narr-cn">${card.cn}</div>${en}<div class="hair"></div></div>`;
  } else if (card.kind === 'lyric') {
    html = `<div class="card-inner"><div class="cn lyric-cn">${card.cn}</div><div class="rule" style="width:150px"></div>${en}</div>`;
  }
  cardEl.innerHTML = html;
  cardEl.style.opacity = op.toFixed(3);
  cardEl.style.transform = `translateY(${(rise + (card.dy || 0)).toFixed(2)}px)`;
  const tc = cardEl.querySelector('.title-cn');
  if (tc && card.spread) {
    const s = 0.34 + (1 - Math.min(1, p / 0.7)) * 0.16;
    tc.style.letterSpacing = s.toFixed(3) + 'em';
    tc.style.textIndent = s.toFixed(3) + 'em';
  }
}

function entryAt(t) {
  for (const e of TIMELINE) if (t >= e.t0 && t < e.t1) return e;
  return TIMELINE[TIMELINE.length - 1];
}
function stampAlpha(t) {
  let a = 0;
  for (const s of STAMPS) {
    if (t >= s.t0 && t <= s.t1) {
      const k = Math.min(1, (t - s.t0) / 0.9, (s.t1 - t) / 0.9);
      a = Math.max(a, Math.max(0, k));
    }
  }
  return a;
}
function fadeAlpha(t) {
  let a = 0;
  for (const tr of TRANSITIONS) {
    if (t >= tr.t0 && t <= tr.t1) {
      const mid = (tr.t0 + tr.t1) / 2;
      const k = t < mid ? (t - tr.t0) / (mid - tr.t0) : (tr.t1 - t) / (tr.t1 - mid);
      a = Math.max(a, Math.min(1, Math.max(0, k)) * (tr.max ?? 1));
    }
  }
  return a;
}

rollEl.innerHTML = ROLL.map((b) => b.sign
  ? `<div class="roll-block big-sign"><div class="a">${b.sign}</div><div class="b">${b.sub || ''}</div></div>`
  : `<div class="roll-block"><div class="roll-l">${b.label}</div><div class="roll-v">${b.cn}</div>${b.en ? `<div class="roll-v2">${b.en}</div>` : ''}</div>`
).join('');

/* ---------------- 主渲染 ---------------- */
function frame(t) {
  t = Math.max(0, Math.min(DURATION - 1e-4, t));
  const entry = entryAt(t);
  const shot = getShot(entry);
  const lt = t - entry.t0;
  const ld = entry.t1 - entry.t0;
  shot.update(lt, ld, entry);
  activeShot = shot;
  applyShotParams(shot, entry);

  // 1. 场景 → sceneRT
  renderer.setRenderTarget(sceneRT);
  renderer.clear(true, true, false);
  renderer.render(shot.scene, shot.camera);

  // 2. 景深 → dofRT
  if (shot.quad) {
    copyMat.uniforms.tDiffuse.value = sceneRT.texture;
    fsPass(copyMat, dofRT);
  } else {
    dofMat.uniforms.tDiffuse.value = sceneRT.texture;
    dofMat.uniforms.tDepth.value = depthTex;
    fsPass(dofMat, dofRT);
  }

  // 3. 辉光
  bloomPass.render(renderer, null, dofRT);

  // 4. 调色输出
  const u = finalMat.uniforms;
  u.tDiffuse.value = dofRT.texture;
  u.uTime.value = t;
  u.uExp.value = entry.grade?.exp ?? 1.0;
  u.uGrain.value = entry.grade?.grain ?? 0.055;
  u.uCA.value = entry.grade?.ca ?? 0.0016;
  u.uVig.value = entry.grade?.vig ?? 0.30;
  u.uSat.value = entry.grade?.sat ?? 1.0;
  u.uWarm.value = entry.grade?.warm ?? 0.06;
  u.uWeave.value = entry.grade?.weave ?? 1.0;
  u.uStreak.value = entry.grade?.streak ?? 0.10;
  fsPass(finalMat, null);

  // 5. 字幕层
  let card = null, cp = 0;
  for (const c of (entry.cards || [])) {
    if (t >= c.t0 && t < c.t1) { card = c; cp = (t - c.t0) / (c.t1 - c.t0); break; }
  }
  renderCard(card, cp);
  stampEl.style.opacity = stampAlpha(t).toFixed(3);

  if (entry.roll) {
    const k = (t - entry.roll.t0) / (entry.roll.t1 - entry.roll.t0);
    const scrollH = rollEl.scrollHeight;
    rollEl.style.opacity = String(Math.min(1, k * 6, (1 - k) * 6));
    rollEl.style.transform = `translateY(${H - k * (scrollH + H)}px)`;
  } else {
    rollEl.style.opacity = 0;
  }
  fadeEl.style.opacity = fadeAlpha(t).toFixed(3);

  return { shot: entry.id, factory: entry.factory, card: card ? card.cn : null };
}

window.MV = {
  duration: DURATION, W, H, frame, ready: true,
  list() { return TIMELINE.map((e) => ({ id: e.id, t0: e.t0, t1: e.t1 })); },
};

requestAnimationFrame(() => {
  try { frame(0.1); } catch (e) { console.error(e); }
});

window.addEventListener('error', (e) => {
  window.MV_ERROR = String(e.message || e.error);
  console.error('MV_ERROR', e.message);
});
