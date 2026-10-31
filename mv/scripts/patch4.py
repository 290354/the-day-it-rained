import io
SH = r"C:/Users/admin/WorkBuddy/2026-10-24-22-23-14/mv/src/shots.js"
s = io.open(SH, encoding="utf-8").read()
n = 0
def R(old, new, txt):
    global n
    assert old in txt, "MISS: " + old[:70]
    n += 1
    return txt.replace(old, new, 1)

# 1) 麦田：修正几何基准（原来半截埋在地下，导致逆光失效）
s = R("""  const base = new THREE.PlaneGeometry(0.030, 1.0, 1, 4);
  g.setAttribute('position', base.attributes.position);""",
      """  const base = new THREE.PlaneGeometry(0.030, 1.0, 1, 4);
  base.translate(0, 0.5, 0);
  g.setAttribute('position', base.attributes.position);""", s)
s = R("""    const r = Math.pow(rnd(), 0.55) * 58;""",
      """    const r = Math.pow(rnd(), 0.75) * 62;""", s)

# 2) 彩虹：改为 HSV 色环 + 二次虹
s = R("""      void main(){
        vec2 uv = vUv;
        vec2 p = vec2((uv.x-0.5)*(1.0-uZoom*0.10)+0.5, uv.y);""",
      """      vec3 hsv2rgb(vec3 c){
        vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
        rgb = rgb*rgb*(3.0-2.0*rgb);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      void main(){
        vec2 uv = vUv;
        vec2 p = vec2((uv.x-0.5)*(1.0-uZoom*0.10)+0.5, uv.y);""", s)
s = R("""        float t = clamp((r-(R-0.075))/0.15, 0.0, 1.0);
        vec3 rb = vec3(0.0);
        rb += vec3(1.00,0.26,0.20) * exp(-pow((t-0.10)/0.10,2.0));
        rb += vec3(1.00,0.58,0.18) * exp(-pow((t-0.28)/0.10,2.0));
        rb += vec3(1.00,0.90,0.36) * exp(-pow((t-0.46)/0.09,2.0));
        rb += vec3(0.36,0.92,0.56) * exp(-pow((t-0.63)/0.09,2.0));
        rb += vec3(0.28,0.66,1.00) * exp(-pow((t-0.79)/0.09,2.0));
        rb += vec3(0.52,0.40,1.00) * exp(-pow((t-0.94)/0.10,2.0));
        float grain = 0.55 + 0.75*fbm(vec2(ang*6.0, r*80.0) + uTime*0.15);
        col += rb * band * span * grain * 1.05 * uArc;""",
      """        float t = clamp((r-(R-0.070))/0.14, 0.0, 1.0);
        vec3 rb = hsv2rgb(vec3(mix(0.0, 0.76, t), 0.78, 1.0));
        float band2 = exp(-pow((r-(R+0.088))/0.042, 2.0)) * 0.20;
        vec3 rb2 = hsv2rgb(vec3(mix(0.22, 0.58, t), 0.55, 1.0));
        float grain = 0.50 + 0.80*fbm(vec2(ang*7.0, r*90.0) + uTime*0.15);
        col += (rb*band + rb2*band2) * span * grain * 0.58 * uArc;""", s)
s = R("float R = 0.86;", "float R = 0.82;", s)

# 3) 雨伞：边缘光收敛，机位改为仰视
s = R("vec3 col = base + vec3(1.0,0.80,0.55)*fres*1.9;",
      "vec3 col = base + vec3(1.0,0.80,0.55)*fres*0.62;", s)
s = R("col += vec3(0.55,0.62,0.75)*rib*fres*0.5;",
      "col += vec3(0.55,0.62,0.75)*rib*fres*0.22;", s)
s = R("camera.position.set(lerp(0.25, -0.32, e), lerp(0.82, 1.02, e), lerp(5.6, 3.5, e));",
      "camera.position.set(lerp(0.30, -0.34, e), lerp(0.42, 0.66, e), lerp(5.2, 3.2, e));", s)
s = R("aim(camera, V3(lerp(0, -0.06, e), lerp(0.98, 1.02, e), 0), 0.03);",
      "aim(camera, V3(lerp(0, -0.05, e), lerp(1.06, 1.10, e), 0), 0.04);", s)

# 4) 站台：加地平线暖光，强化剪影
s = R("""  // 远景灯海
  const bg = bokehField(""",
      """  // 地平线暖光（把人物衬成剪影）
  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(180, 34), new THREE.MeshBasicMaterial({
    map: texGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffb070, opacity: 0.17,
  }));
  horizon.position.set(0, 5.0, -74);
  scene.add(horizon);

  // 远景灯海
  const bg = bokehField(""", s)

# 5) 空站台：伞成为主体
s = R("  stand.position.set(1.2, 0, -6.4);\n  stand.rotation.y = 0.5;",
      "  stand.position.set(0.75, 0, -5.4);\n  stand.rotation.y = 0.62;\n  stand.scale.setScalar(1.3);", s)
s = R("""      camera.position.set(lerp(-1.2, -0.2, e), lerp(1.35, 2.1, e), lerp(1.2, 8.5, e));
      aim(camera, V3(lerp(0.6, 0.4, e), lerp(1.15, 1.5, e), -6.8), lerp(0.008, 0, e));""",
      """      camera.position.set(lerp(-0.9, -0.1, e), lerp(1.00, 1.72, e), lerp(2.4, 9.2, e));
      aim(camera, V3(lerp(0.75, 0.62, e), lerp(1.05, 1.35, e), -5.8), lerp(0.008, 0, e));""", s)
s = R("""  // 悬浮的水珠（雨停在半空）""",
      """  // 伞后的暖光
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({
    map: texBokeh(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xffa661, opacity: 0.30,
  }));
  sb.position.set(0.75, 1.25, -6.3);
  scene.add(sb);

  // 悬浮的水珠（雨停在半空）""", s)

# 6) 云层俯瞰：城市成簇，街网变细
s = R("""          vec2 gp = abs(fract(p*0.016)-0.5);
          float st = smoothstep(0.492,0.5,gp.x)+smoothstep(0.492,0.5,gp.y);
          float d = hash21(floor(p*0.30));
          float car = step(0.972, d) * (0.55+0.45*sin(uTime*2.0+d*40.0));
          float glow = exp(-length(p)*0.0035);
          vec3 c = vec3(1.0,0.60,0.26)*(st*0.75 + car*2.6)*1.35;
          c += vec3(0.10,0.16,0.26)*glow*1.2;
          c *= 0.55 + 0.75*glow;""",
      """          float cl = fbm(p*0.0022 + 3.1);
          float cluster = smoothstep(0.34, 0.72, cl);
          vec2 gp = abs(fract(p*0.016)-0.5);
          float st = (smoothstep(0.4965,0.5,gp.x)+smoothstep(0.4965,0.5,gp.y)) * cluster;
          float d = hash21(floor(p*0.30));
          float car = step(0.976, d) * (0.55+0.45*sin(uTime*2.0+d*40.0)) * cluster;
          float glow = exp(-length(p)*0.0030);
          vec3 c = vec3(1.0,0.60,0.26)*(st*0.42 + car*2.2)*1.15;
          c += vec3(0.07,0.11,0.19)*glow*0.55*cluster;
          c *= 0.25 + 0.85*cluster;""", s)

io.open(SH, "w", encoding="utf-8").write(s)
print("patched", n)
