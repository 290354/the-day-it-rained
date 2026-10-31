import io, re, sys

P = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/shots.js"
src = io.open(P, encoding="utf-8").read()

GLASS = r'''export function shotGlass() {
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
          float s = 9.0 + Lf*12.0;
          vec2 g = uvz*s + vec2(0.0, uTime*(0.020 + 0.014*Lf));
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5;
          float h1 = hash21(id + Lf*13.0);
          float h2 = hash21(id + Lf*29.0);
          float h3 = hash21(id + Lf*7.7);
          if(h3 > 0.42){
            float r = (0.36 - Lf*0.085) * (0.34 + 0.66*h1);
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
            rr *= 1.45 + 0.5*(1.0-Lf*0.25);
            float rim = smoothstep(r*0.78, r*0.97, dist) * (1.0 - smoothstep(r*0.97, r*1.02, dist));
            rr += vec3(0.50,0.58,0.68) * rim * 0.42;
            float hi = exp(-pow(length(d - vec2(-r*0.30, r*0.32))/(r*0.20), 2.0));
            rr += vec3(1.0,0.96,0.90) * hi * 0.85;
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
'''

RAINBOW = r'''export function shotRainbow() {
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
        vec3 mid = vec3(0.42,0.44,0.44);
        vec3 low = vec3(0.86,0.68,0.44);
        vec3 c = mix(mid, top, smoothstep(0.40,1.0,p.y));
        c = mix(c, low, smoothstep(0.42,0.02,p.y));
        // 云层
        float cl = fbm(vec2(p.x*3.2 + uTime*0.012, p.y*4.6));
        float cl2 = fbm(vec2(p.x*7.0 - uTime*0.02, p.y*9.0));
        float clouds = smoothstep(0.42,0.86, cl*0.75 + cl2*0.4);
        c = mix(c, mix(vec3(0.62,0.64,0.66), vec3(0.88,0.80,0.68), p.y), clouds*0.55);
        // 地平线以上的暗云带
        c *= 1.0 - smoothstep(0.30,0.0,p.y)*0.35;
        return c;
      }

      void main(){
        vec2 uv = vUv;
        vec2 p = vec2((uv.x-0.5)*(1.0-uZoom*0.10)+0.5, uv.y);
        vec3 col = sky(p);

        // 低悬的太阳
        vec2 sunP = vec2(0.235 + uPan*0.6, 0.255);
        float sd = length((p-sunP)*vec2(1.0,1.05));
        col += vec3(1.0,0.72,0.42) * exp(-sd*7.0) * 1.35;
        col += vec3(1.0,0.88,0.66) * smoothstep(0.030,0.012,sd) * 1.6;

        // 倒置彩虹：圆心在画面上方，弧向下弯
        vec2 cen = vec2(0.50, 1.34);
        vec2 q = (p - cen) * vec2(1.0, 1.06);
        float r = length(q);
        float R = 0.86;
        float band = exp(-pow((r-R)/0.052, 2.0));
        float ang = atan(q.x, -q.y);          // 0 = 正下方
        float span = smoothstep(1.35, 0.35, abs(ang));   // 弧的可见范围
        float t = clamp((r-(R-0.075))/0.15, 0.0, 1.0);
        vec3 rb = vec3(0.0);
        rb += vec3(1.00,0.26,0.20) * exp(-pow((t-0.10)/0.10,2.0));
        rb += vec3(1.00,0.58,0.18) * exp(-pow((t-0.28)/0.10,2.0));
        rb += vec3(1.00,0.90,0.36) * exp(-pow((t-0.46)/0.09,2.0));
        rb += vec3(0.36,0.92,0.56) * exp(-pow((t-0.63)/0.09,2.0));
        rb += vec3(0.28,0.66,1.00) * exp(-pow((t-0.79)/0.09,2.0));
        rb += vec3(0.52,0.40,1.00) * exp(-pow((t-0.94)/0.10,2.0));
        float grain = 0.55 + 0.75*fbm(vec2(ang*6.0, r*80.0) + uTime*0.15);
        col += rb * band * span * grain * 0.55 * uArc;

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
    scene, camera, bloom: 1.0, exposure: 0.96, quad: true,
    update(t, dur) {
      const k = clamp(t / dur, 0, 1);
      uniforms.uTime.value = t;
      uniforms.uArc.value = smooth(Math.min(1, k * 2.2));
      uniforms.uPan.value = lerp(-0.05, 0.05, easeInOut(k));
      uniforms.uZoom.value = easeInOut(k);
    },
  };
}
'''

FIELD = r'''export function shotField() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1920 / 804, 0.1, 400);
  const upd = [];

  scene.add(createSkyDome({ top: 0x0a1522, horizon: 0x6d5a3c, glow: 0xc98a3a, glowDir: [0.12, 0.06, -1], glowAmt: 2.2, size: 260 }));

  // 夕阳圆盘 + 光晕
  const sunMat = new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffd9a0, opacity: 0.9,
  });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), sunMat);
  sun.position.set(26, 3.2, -190);
  scene.add(sun);

  const count = 16000;
  const rnd = rng(123);
  const g = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(0.030, 1.0, 1, 4);
  g.setAttribute('position', base.attributes.position);
  g.setAttribute('uv', base.attributes.uv);
  g.setIndex(new THREE.BufferAttribute(base.index.array, 1));
  const off = new Float32Array(count * 3);
  const par = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.pow(rnd(), 0.55) * 58;
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
        vec3 c = uDark;
        c += uGold * tip * (0.10 + back*0.85) * 0.85;
        c += uGold * back * 0.10 * smoothstep(0.0,0.5,vH);
        float d = length(vW - cameraPosition);
        c *= 1.0 - smoothstep(18.0, 55.0, d)*0.30;
        float a = smoothstep(0.0, 0.10, vH);
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
  haze.position.set(10, 6, -70);
  scene.add(haze);

  const rain = createRain({ count: 2600, area: [60, 30, 60], speed: [9, 15], len: [0.5, 1.5], width: 0.010, opacity: 0.22, seed: 8, color: 0xffe6c0 });
  scene.add(rain); upd.push((t) => rain.userData.update(t));

  return {
    scene, camera, bloom: 1.0, exposure: 1.02,
    update(t, dur) {
      upd.forEach((f) => f(t));
      const k = clamp(t / dur, 0, 1);
      const e = easeInOut(k);
      camera.position.set(lerp(-7, 3.0, e), lerp(1.15, 0.95, e), lerp(11, 5.6, e));
      aim(camera, V3(lerp(2.0, 4.0, e), lerp(2.6, 2.2, e), -60), lerp(0.02, 0, e));
      camera.position.add(handheld(t, 0.03, 1.1));
    },
  };
}
'''

def replace_block(src, start_key, end_key, new):
    i = src.index(start_key)
    j = src.index(end_key)
    k = src.rfind("/* =", 0, j)
    return src[:i] + new + "\n" + src[k:]

src = replace_block(src, "export function shotGlass()", "   3. 夜雨站台", GLASS)
src = replace_block(src, "export function shotRainbow()", "   10. 撑伞", RAINBOW)
src = replace_block(src, "export function shotField()", "   9. 反向彩虹", FIELD)

io.open(P, "w", encoding="utf-8").write(src)
print("ok", len(src))
