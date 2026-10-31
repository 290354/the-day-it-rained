import io

SH = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/shots.js"
MJ = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/main.js"

s = io.open(SH, encoding="utf-8").read()
m = io.open(MJ, encoding="utf-8").read()
n = 0
def R(old, new, txt, count=1):
    global n
    assert txt.count(old) >= 1, "MISS: " + old[:70]
    txt = txt.replace(old, new, count)
    n += 1
    return txt

# ---------- 玻璃：水珠质感 ----------
s = R("float s = 9.0 + Lf*12.0;", "float s = 8.0 + Lf*9.0;", s)
s = R("if(h3 > 0.42){", "if(h3 > 0.50){", s)
s = R("float r = (0.36 - Lf*0.085) * (0.34 + 0.66*h1);",
      "float r = (0.42 - Lf*0.10) * (0.30 + 0.70*h1);", s)
s = R("""            float rim = smoothstep(r*0.78, r*0.97, dist) * (1.0 - smoothstep(r*0.97, r*1.02, dist));
            rr += vec3(0.50,0.58,0.68) * rim * 0.42;
            float hi = exp(-pow(length(d - vec2(-r*0.30, r*0.32))/(r*0.20), 2.0));
            rr += vec3(1.0,0.96,0.90) * hi * 0.85;""",
      """            float rim = smoothstep(r*0.72, r*0.96, dist) * (1.0 - smoothstep(r*0.96, r*1.04, dist));
            rim *= smoothstep(-0.10, 0.55, d.y/max(r,1e-4));
            rr += vec3(0.42,0.50,0.60) * rim * 0.24;
            float hi = exp(-pow(length(d - vec2(-r*0.30, r*0.32))/(r*0.18), 2.0));
            rr += vec3(1.0,0.96,0.90) * hi * 0.95;
            float caus = exp(-pow(length(d - vec2(0.0, r*0.46))/(r*0.26), 2.0));
            rr += vec3(0.95,0.84,0.68) * caus * 0.30;""", s)
s = R("rr *= 1.45 + 0.5*(1.0-Lf*0.25);", "rr *= 1.20 + 0.35*(1.0-Lf*0.25);", s)

# ---------- 云层：压曝光 ----------
s = R("uC1: { value: new THREE.Color(0x2a3a48) }, uC2: { value: new THREE.Color(0xa8b6c2) },",
      "uC1: { value: new THREE.Color(0x1b2a38) }, uC2: { value: new THREE.Color(0x68798b) },", s)
s = R("col += uGlow * rim * 1.15;", "col += uGlow * rim * 0.52;", s)
s = R("col += uGlow * under * 0.30;", "col += uGlow * under * 0.15;", s)
s = R("glowAmt: 1.8, size: 900", "glowAmt: 1.0, size: 900", s)
s = R("scene, camera, bloom: 1.0, exposure: 1.05,\n    update(t, dur) {\n      upd.forEach((f) => f(t));\n      const k = clamp(t / dur, 0, 1);\n      const e = easeInOut(k);\n      camera.position.set(lerp(-18, 2, e)",
      "scene, camera, bloom: 0.75, exposure: 0.95,\n    update(t, dur) {\n      upd.forEach((f) => f(t));\n      const k = clamp(t / dur, 0, 1);\n      const e = easeInOut(k);\n      camera.position.set(lerp(-18, 2, e)", s)

# ---------- 彩虹：压太阳与天空 ----------
s = R("col += vec3(1.0,0.72,0.42) * exp(-sd*7.0) * 1.35;", "col += vec3(1.0,0.70,0.40) * exp(-sd*9.0) * 0.46;", s)
s = R("col += vec3(1.0,0.88,0.66) * smoothstep(0.030,0.012,sd) * 1.6;", "col += vec3(1.0,0.90,0.72) * smoothstep(0.026,0.010,sd) * 0.72;", s)
s = R("vec3 mid = vec3(0.42,0.44,0.44);\n        vec3 low = vec3(0.86,0.68,0.44);",
      "vec3 mid = vec3(0.26,0.31,0.34);\n        vec3 low = vec3(0.56,0.47,0.34);", s)
s = R("col += rb * band * span * grain * 0.55 * uArc;", "col += rb * band * span * grain * 1.05 * uArc;", s)
s = R("scene, camera, bloom: 1.0, exposure: 0.96, quad: true,", "scene, camera, bloom: 0.55, exposure: 0.98, quad: true,", s)

# ---------- 麦田：小太阳、冷天空、更密 ----------
s = R("glow: 0xc98a3a, glowDir: [0.12, 0.06, -1], glowAmt: 2.2, size: 260", "glow: 0x8f6a3e, glowDir: [0.12, 0.06, -1], glowAmt: 1.15, size: 260", s)
s = R("top: 0x0a1522, horizon: 0x6d5a3c,", "top: 0x0b1a26, horizon: 0x4a4436,", s)
s = R("const sun = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), sunMat);", "const sun = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), sunMat);", s)
s = R("color: 0xffd9a0, opacity: 0.9,", "color: 0xffd9a0, opacity: 0.55,", s)
s = R("const count = 16000;", "const count = 26000;", s)
s = R("""  haze.position.set(10, 6, -70);
  scene.add(haze);""", """  haze.scale.set(1.6, 1.9, 1);
  haze.position.set(8, 7, -120);
  haze.material.opacity = 0.11;
  scene.add(haze);""", s)

# ---------- 撑伞：拉远机位 ----------
s = R("camera.position.set(lerp(0.15, -0.30, e), lerp(0.95, 1.10, e), lerp(3.3, 1.95, e));",
      "camera.position.set(lerp(0.25, -0.32, e), lerp(0.82, 1.02, e), lerp(5.6, 3.5, e));", s)
s = R("""  const backlight = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 5.0), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffa661, opacity: 0.55,
  }));
  backlight.position.set(0.3, 1.05, -2.2);""",
      """  const backlight = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffa661, opacity: 0.34,
  }));
  backlight.position.set(0.22, 1.34, -2.6);""", s)
s = R("backlight.material.opacity = 0.25 + 0.45 * open;", "backlight.material.opacity = 0.16 + 0.30 * open;", s)

# ---------- 教室：柔化光柱、提亮窗外 ----------
s = R("""    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 15), new THREE.MeshBasicMaterial({
      map: texGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      color: 0xfff0d2, opacity: 0.085,
    }));""",
      """    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 17), new THREE.MeshBasicMaterial({
      map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      color: 0xfff0d2, opacity: 0.18,
    }));""", s)
s = R("gl_FragColor = vec4(c*0.62,1.0);", "gl_FragColor = vec4(c*0.86,1.0);", s)

# ---------- 后期：高光柔性压缩 ----------
m = R("""      // 暗角
      float vig = smoothstep(1.24, 0.18, length(d*vec2(1.0,1.18))*1.42);""",
      """      // 高光柔性压缩（防止死白）
      vec3 over = max(vec3(0.0), col - 0.80);
      col = col - over + over / (1.0 + over * 0.85);

      // 暗角
      float vig = smoothstep(1.24, 0.18, length(d*vec2(1.0,1.18))*1.42);""", m)

io.open(SH, "w", encoding="utf-8").write(s)
io.open(MJ, "w", encoding="utf-8").write(m)
print("patched", n, "edits")
