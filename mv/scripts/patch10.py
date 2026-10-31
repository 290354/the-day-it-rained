import io

LB = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/lib.js"
SH = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/shots.js"
lb = io.open(LB, encoding="utf-8").read()
sh = io.open(SH, encoding="utf-8").read()
n = 0
def RL(old, new):
    global lb, n
    assert old in lb, "MISS-L: " + old[:70]
    lb = lb.replace(old, new, 1); n += 1
def RS(old, new):
    global sh, n
    assert old in sh, "MISS-S: " + old[:70]
    sh = sh.replace(old, new, 1); n += 1

# 1) 人物：轮廓光方向化、收敛（原来是全身霓虹描边）
RL("""      uRim: { value: new THREE.Color(0xffb173) },
      uRimAmt: { value: 0.85 },
    },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0);
        vN = normalize(mat3(modelMatrix)*normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCol,uRim; uniform float uRimAmt;
      varying vec3 vN; varying vec3 vV;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(f, 2.4);
        vec3 c = uCol + uRim * rim * uRimAmt;
        gl_FragColor = vec4(c, 1.0);
      }`,""",
   """      uRim: { value: new THREE.Color(0xffb173) },
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
      }`,""")

# 2) 湿地面：竖向灯影不要那么像墙
RL("float lane = smoothstep(0.55,1.0, sin(p.x*0.55 + sin(p.x*0.13)*2.0)*0.5+0.5);",
   "float lane = smoothstep(0.62,1.0, sin(p.x*0.55 + sin(p.x*0.13)*2.0)*0.5+0.5);")
RL("col += uGlow * (0.05 + spec*0.55*uRefl) * lane * uI;",
   "col += uGlow * (0.018 + spec*0.50*uRefl) * lane * uI;")

# 3) 溅射收敛
RS("const splash = createSplashes({ count: 1400, area: [36, 30], speed: 2.1, seed: 17 });",
   "const splash = createSplashes({ count: 760, area: [30, 26], speed: 2.4, seed: 17 });")
RL("uniform float uTime, uSpeed;\n      varying float vA;", "uniform float uTime, uSpeed;\n      varying float vA;")
RL("uO: { value: 0.5 },", "uO: { value: 0.20 },")

# 4) 站台：地平线暖光加强 + 人物背后加一层城市辉光
RS("color: 0xffa864, opacity: 0.13,", "color: 0xffa864, opacity: 0.22,")
RS("""  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(300, 130), new THREE.MeshBasicMaterial({""",
   """  const cityGlow = new THREE.Mesh(new THREE.PlaneGeometry(120, 26), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0x8fb4e0, opacity: 0.10,
  }));
  cityGlow.position.set(-2, 3.2, -34);
  scene.add(cityGlow);

  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(300, 130), new THREE.MeshBasicMaterial({""")

# 5) 过肩机位重定位（原来钻进顶棚里，全黑）
RS("""        camera.position.set(lerp(-3.4, -3.0, e), lerp(1.56, 1.50, e), lerp(-3.9, -4.5, e));
        aim(camera, V3(-0.6, 1.42, -9.5), lerp(0.01, 0, e));
        camera.fov = lerp(38, 32, e);""",
   """        camera.position.set(lerp(-4.2, -3.5, e), lerp(1.52, 1.44, e), lerp(-11.6, -12.4, e));
        aim(camera, V3(lerp(-2.6, -2.2, e), lerp(1.30, 1.34, e), -4.2), lerp(-0.01, 0, e));
        camera.fov = lerp(34, 30, e);""")

io.open(LB, "w", encoding="utf-8").write(lb)
io.open(SH, "w", encoding="utf-8").write(sh)
print("patched", n)
