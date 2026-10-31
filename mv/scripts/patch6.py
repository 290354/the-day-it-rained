import io
SH = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/shots.js"
s = io.open(SH, encoding="utf-8").read()
n = 0
def R(old, new):
    global s, n
    assert old in s, "MISS: " + old[:70]
    s = s.replace(old, new, 1); n += 1

# 站台：去掉露边界的矩形雾，改柔和径向光
R("""  const mist = new THREE.Mesh(new THREE.PlaneGeometry(90, 26), new THREE.MeshBasicMaterial({
    map: texGlow(), transparent: true, blending: THREE.AdditiveBlending, opacity: 0.05, depthWrite: false,
    color: 0x88aacc,
  }));
  mist.position.set(0, 8, -30);
  scene.add(mist);""",
  """  const mist = new THREE.Mesh(new THREE.PlaneGeometry(300, 150), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, opacity: 0.030, depthWrite: false,
    color: 0x8fb2d6,
  }));
  mist.position.set(0, 9, -62);
  scene.add(mist);""")
R("""  const bg = bokehField(160, [120, 26, 90], rng(41), (r) => {""",
  """  const bg = bokehField(110, [170, 13, 90], rng(41), (r) => {""")
R("""    return c;
  }, [0.35, 2.2]);
  bg.position.set(0, 2, -55);""",
  """    return c;
  }, [0.28, 1.45]);
  bg.position.set(0, 3.6, -58);""")
R("glowDir: [0, 0.02, -1], glowAmt: 0.9, size: 300", "glowDir: [0, 0.02, -1], glowAmt: 1.7, size: 300")

# 彩虹：带宽更完整、更亮、太阳柔化
R("float band = exp(-pow((r-R)/0.052, 2.0));", "float band = exp(-pow((r-R)/0.080, 2.0));")
R("float t = clamp((r-(R-0.070))/0.14, 0.0, 1.0);", "float t = clamp((r-(R-0.088))/0.176, 0.0, 1.0);")
R("col += (rb*band + rb2*band2) * span * grain * 0.26 * uArc;",
  "col += (rb*band + rb2*band2) * span * grain * 0.40 * uArc;")
R("col += vec3(1.0,0.90,0.72) * smoothstep(0.026,0.010,sd) * 0.72;",
  "col += vec3(1.0,0.90,0.72) * exp(-pow(sd/0.021,2.0)) * 0.85;")
R("vec3 mid = vec3(0.15,0.19,0.23);\n        vec3 low = vec3(0.40,0.34,0.26);",
  "vec3 mid = vec3(0.11,0.14,0.19);\n        vec3 low = vec3(0.38,0.31,0.24);")
R("vec3 rb = hsv2rgb(vec3(mix(0.0, 0.76, t), 0.78, 1.0));",
  "vec3 rb = hsv2rgb(vec3(mix(0.0, 0.75, t), 0.92, 1.0));")

io.open(SH, "w", encoding="utf-8").write(s)
print("patched", n)
