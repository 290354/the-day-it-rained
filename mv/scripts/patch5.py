import io
SH = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/shots.js"
s = io.open(SH, encoding="utf-8").read()
n = 0
def R(old, new):
    global s, n
    assert old in s, "MISS: " + old[:70]
    s = s.replace(old, new, 1); n += 1

# ---- 麦田 ----
R("const base = new THREE.PlaneGeometry(0.030, 1.0, 1, 4);",
  "const base = new THREE.PlaneGeometry(0.017, 1.0, 1, 4);")
R("const count = 26000;", "const count = 34000;")
R("""        vec3 c = uDark;
        c += uGold * tip * (0.10 + back*0.85) * 0.85;
        c += uGold * back * 0.10 * smoothstep(0.0,0.5,vH);
        float d = length(vW - cameraPosition);
        c *= 1.0 - smoothstep(18.0, 55.0, d)*0.30;
        float a = smoothstep(0.0, 0.10, vH);
        gl_FragColor = vec4(c, a);""",
  """        float vary = 0.65 + 0.55*fract(vSeed*7.31);
        vec3 c = uDark;
        c += uGold * tip * (0.06 + back*0.62) * 0.80 * vary;
        c += uGold * back * 0.06 * smoothstep(0.0,0.5,vH);
        float d = length(vW - cameraPosition);
        c *= 1.0 - smoothstep(20.0, 58.0, d)*0.35;
        float a = smoothstep(0.0, 0.10, vH);
        a *= smoothstep(1.0, 3.4, d);          // 剔除贴脸的巨大叶片
        gl_FragColor = vec4(c, a);""")
R("camera.position.set(lerp(-7, 3.0, e), lerp(1.15, 0.95, e), lerp(11, 5.6, e));",
  "camera.position.set(lerp(-7, 3.0, e), lerp(1.42, 1.18, e), lerp(9.5, 5.2, e));")

# ---- 彩虹 ----
R("col += (rb*band + rb2*band2) * span * grain * 0.58 * uArc;",
  "col += (rb*band + rb2*band2) * span * grain * 0.26 * uArc;")
R("vec3 mid = vec3(0.26,0.31,0.34);\n        vec3 low = vec3(0.56,0.47,0.34);",
  "vec3 mid = vec3(0.15,0.19,0.23);\n        vec3 low = vec3(0.40,0.34,0.26);")
R("c = mix(c, mix(vec3(0.62,0.64,0.66), vec3(0.88,0.80,0.68), p.y), clouds*0.55);",
  "c = mix(c, mix(vec3(0.30,0.33,0.36), vec3(0.52,0.47,0.40), p.y), clouds*0.42);")
R("col += vec3(1.0,0.70,0.40) * exp(-sd*9.0) * 0.46;",
  "col += vec3(1.0,0.70,0.40) * exp(-sd*9.0) * 0.34;")
R("uniform float uTime, uArc, uPan, uZoom;", "uniform float uTime, uArc, uPan, uZoom;")

# ---- 撑伞：去掉乱飘的伞骨，抬高伞身 ----
R("""  const ribMat = new THREE.MeshBasicMaterial({ color: 0x14181f });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 1.0, 4), ribMat);
    rib.position.set(Math.cos(a) * 0.5, -0.45, Math.sin(a) * 0.5);
    rib.rotation.z = Math.cos(a) * 0.5;
    rib.rotation.x = -Math.sin(a) * 0.5;
    umb.add(rib);
  }
  const pole""", """  const pole""")
R("umb.position.set(0, 0.95, 0);", "umb.position.set(0, 1.12, 0);")
R("umb.position.y = lerp(0.62, 0.95, open);", "umb.position.y = lerp(0.80, 1.12, open);")
R("camera.position.set(lerp(0.30, -0.34, e), lerp(0.42, 0.66, e), lerp(5.2, 3.2, e));",
  "camera.position.set(lerp(0.30, -0.34, e), lerp(0.30, 0.52, e), lerp(5.0, 3.0, e));")

# ---- 站台：地平线光柔化 + 人物拉近 ----
R("""  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(180, 34), new THREE.MeshBasicMaterial({
    map: texGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffb070, opacity: 0.17,
  }));
  horizon.position.set(0, 5.0, -74);""",
  """  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(300, 130), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffa864, opacity: 0.13,
  }));
  horizon.position.set(0, 7.0, -78);""")
R("""    const f1 = createFigure({ height: 1.74, umbrella: true });
    f1.position.set(-2.2, 0, -9.5);
    scene.add(f1);
    if (figures > 1) {
      const f2 = createFigure({ height: 1.66 });
      f2.position.set(-0.6, 0, -9.0);
      f2.rotation.y = -0.5;
      scene.add(f2);
    }""",
  """    const f1 = createFigure({ height: 1.74, umbrella: true });
    f1.position.set(-2.35, 0, -6.4);
    f1.rotation.y = 0.35;
    scene.add(f1);
    if (figures > 1) {
      const f2 = createFigure({ height: 1.66 });
      f2.position.set(-0.85, 0, -5.9);
      f2.rotation.y = -0.55;
      scene.add(f2);
    }""")
R("const cone = createLightCone({ color: 0xff9b45, height: 5.6, rTop: 0.12, rBot: 3.4, opacity: 0.16 });",
  "const cone = createLightCone({ color: 0xff9b45, height: 5.6, rTop: 0.12, rBot: 3.4, opacity: 0.085 });")
R("aim(camera, V3(lerp(-1.2, -1.0, e), 1.45, -9.5), lerp(-0.012, 0, e));",
  "aim(camera, V3(lerp(-1.5, -1.3, e), 1.30, -6.4), lerp(-0.012, 0, e));")

io.open(SH, "w", encoding="utf-8").write(s)
print("patched", n)
