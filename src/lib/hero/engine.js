/* eslint-disable */
/**
 * The GW250114 hero: two black holes, to scale with their measured masses, orbiting, merging
 * and ringing down, with the gravitational waves spreading across the orbital plane and
 * starlight bending around the horizons. Every clock, frequency and amplitude is the signal
 * recorded at LIGO Livingston (public/data/gw250114-overture.json).
 *
 * Adapted from the overture engine of Attia A. Gadallah's talk "What the Wrong Model Knows":
 * the scene, shaders and physics are unchanged; the slide wiring is replaced by mountHero(),
 * and wheel zoom and global keys are removed so the page scrolls normally.
 */
export function mountHero(stage, D) {
  'use strict';
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var G = D.grid;
  /* ?hero=<seconds> freezes the scene at that moment: a test hook and a freeze-frame */
  var qm = /[?&]hero=(-?[\d.]+)/.exec(location.search), FIXED = qm ? parseFloat(qm[1]) : null;
  function mark(k, v) { stage.setAttribute('data-hero-' + k, v); }

  function table(arr, t) {
    var i = (t - G.t0) / G.dt;
    if (i <= 0) return arr[0];
    if (i >= G.n - 1) return arr[G.n - 1];
    var k = i | 0, a = i - k;
    return arr[k] * (1 - a) + arr[k + 1] * a;
  }
  /* the merger is the instant of peak amplitude; the label shows it only in a +-1.5 ms window around t = 0 */
  function phaseName(t) { return t < -0.0015 ? 'inspiral' : (t <= 0.0015 ? 'merger' : 'ringdown'); }
  function fmtT(t) { return (t < 0 ? '−' : '+') + Math.abs(t).toFixed(3) + ' s'; }
  function hudOf(el) {
    var o = {};
    if (el) Array.prototype.forEach.call(el.querySelectorAll('[data-k]'), function (n) { o[n.getAttribute('data-k')] = n; });
    return o;
  }
  function setText(n, s) { if (n && n.textContent !== s) n.textContent = s; }
  function ease(u) { u = Math.min(1, Math.max(0, u)); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function sstep(a, b, x) { var u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }
  function set4(v, a, b, c, d) { v[0] = a; v[1] = b; v[2] = c; v[3] = d; }

  /* ------------------------------------------------------------ scene base */
  function Scene(section) { this.section = section; this.running = false; this.paused = false; this.raf = 0; this.dirty = false; }
  Scene.prototype.start = function () {
    var self = this;
    this.stop();
    this.running = true; this.paused = false; this.t0 = performance.now(); this.frames = 0;
    if (this.onStart) this.onStart();
    if (REDUCE) { this.renderStatic(); return; }
    if (FIXED !== null) {
      try { this.frame(FIXED); mark('fixed', FIXED); }
      catch (err) { mark('error', String(err && err.message || err)); }
      return;
    }
    function loop(now) {
      if (!self.running) return;
      try {
        if (!self.paused) {
          self.frame((now - self.t0) / 1000); self.frames++;
          if (self.frames % 30 === 0) mark('frames', self.frames);
        } else if (self.dirty && self.redraw) { self.dirty = false; self.redraw(); }
      } catch (err) { mark('error', String(err && err.message || err)); self.running = false; return; }
      if (self.running) self.raf = requestAnimationFrame(loop);
    }
    this.raf = requestAnimationFrame(loop);
  };
  Scene.prototype.stop = function () {
    this.running = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    if (this.onStop) this.onStop();
  };
  Scene.prototype.togglePause = function () {
    if (REDUCE || !this.running) return;
    if (this.paused) { this.t0 += performance.now() - this.pauseAt; this.paused = false; }
    else { this.pauseAt = performance.now(); this.paused = true; }
  };

  /* ------------------------------------------------------------ 1 · the hero */
  /* GW250114 rendered from its recorded signal. One state per instant (heroState) feeds the renderer,
     the HUD and the waveform strip, so the three cannot drift apart. Physics of the picture:
       clock, GW phase, frequency, amplitude   the recorded signal at Livingston (overture_data.py)
       orbit                                  orbital phase = GW phase / 2; Newtonian separation from f,
                                              closed to zero over the last 4 ms before the peak
       horizons                               to scale with the measured masses; the dark disc is the
                                              shadow, 3 sqrt(3) m across in radius
       lensing                                point-mass deflection, weak field joined to the strong-deflection
                                              limit; moving-lens frequency shift to first order in v
       waves                                  h ~ A(t - r/c) cos(Phi(t - r/c) - 2 phi) in the orbital plane    */
  var HC = { a: 6.0, b: 4.0, c: 4.5, hold: 1.4, fade: 0.5 };          /* screen seconds */
  var HT = { t0: -0.26, t1: -0.04, t2: 0.0, t3: 0.045 };              /* signal seconds from the peak */
  var HLOOP = HC.a + HC.b + HC.c + HC.hold;
  var BC = 5.196152;                                                  /* 3 sqrt(3): shadow radius per unit mass */
  var SW0 = HT.t0 - 0.004, SW1 = HT.t3 + HC.hold * (HT.t3 - HT.t2) / HC.c;
  function heroClock(e) {
    var r = ((e % HLOOP) + HLOOP) % HLOOP, t, slow;
    if (r < HC.a) { t = HT.t0 + (r / HC.a) * (HT.t1 - HT.t0); slow = HC.a / (HT.t1 - HT.t0); }
    else if (r < HC.a + HC.b) { t = HT.t1 + ((r - HC.a) / HC.b) * (HT.t2 - HT.t1); slow = HC.b / (HT.t2 - HT.t1); }
    else { t = HT.t2 + ((r - HC.a - HC.b) / HC.c) * (HT.t3 - HT.t2); slow = HC.c / (HT.t3 - HT.t2); }
    return { t: t, slow: slow, fade: ease(Math.min(1, r / HC.fade, (HLOOP - r) / HC.fade)) };
  }
  function heroE(t) {
    if (t <= HT.t1) return HC.a * (t - HT.t0) / (HT.t1 - HT.t0);
    if (t <= HT.t2) return HC.a + HC.b * (t - HT.t1) / (HT.t2 - HT.t1);
    return HC.a + HC.b + HC.c * (t - HT.t2) / (HT.t3 - HT.t2);
  }
  function heroState(t, S) {
    var HZ = D.horizons, m1 = HZ.m1, m2 = HZ.m2, f = table(D.freq, t), ph = table(D.phase, t);
    var th = ph / 2, c = Math.cos(th), s = Math.sin(th);
    S.t = t; S.f = f; S.phase = ph; S.amp = table(D.amp, t);
    if (t < 0) {
      var sep = table(D.sepM, t) * (1 - sstep(-0.004, 0, t));
      var kap = 1 - sstep(0.5, 4.0, sep);                       /* the two shadows grow into one */
      var w = Math.PI * f * D.scale.tM_det_s;                    /* v/c = omega r in units of M */
      var r1 = m2 * sep, r2 = m1 * sep;
      S.sep = sep; S.vc = table(D.vc, t);
      set4(S.LA, r1 * c, 0, r1 * s, m1); set4(S.LB, -r2 * c, 0, -r2 * s, m2);
      set4(S.VA, -s * w * r1, 0, c * w * r1, BC * (m1 + kap * m2));
      set4(S.VB, s * w * r2, 0, -c * w * r2, BC * (m2 + kap * m1));
      set4(S.EA, c, 0, s, 0); S.kerr = 0;
    } else {
      var mr = 1 + (HZ.mf - 1) * sstep(0, 0.002, t);
      S.sep = 0; S.vc = 0;
      set4(S.LA, 0, 0, 0, mr); set4(S.LB, 0, 0, 0, 0);
      set4(S.VA, 0, 0, 0, BC * mr); set4(S.VB, 0, 0, 0, 0);
      set4(S.EA, c, 0, s, 0.14 * S.amp); S.kerr = HZ.chi * sstep(0, 0.003, t);
    }
    S.burst = Math.exp(-(t / 0.0022) * (t / 0.0022));
    return S;
  }
  function newState() {
    return { LA: new Float32Array(4), LB: new Float32Array(4), VA: new Float32Array(4), VB: new Float32Array(4),
             EA: new Float32Array(4), t: 0, f: 0, phase: 0, amp: 0, sep: 0, vc: 0, kerr: 0, burst: 0 };
  }

  var FS_HERO = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform vec2 uRes; uniform vec3 uCam; uniform vec3 uF; uniform vec3 uR; uniform vec3 uU;',
    'uniform float uFocal; uniform vec2 uShift;',
    'uniform float uT; uniform float uTM; uniform float uSep; uniform float uMode; uniform float uBurst;',
    'uniform float uFade; uniform float uKerr; uniform float uTime;',
    'uniform sampler2D uWave; uniform vec3 uWG;',
    'uniform vec4 uLA; uniform vec4 uLB; uniform vec4 uVA; uniform vec4 uVB; uniform vec4 uEA;',
    'const float PI = 3.14159265;',
    'float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    /* deflection of a ray passing at impact parameter b: weak field to second order, joined to the
       strong-deflection limit (Bozza 2002) that diverges at the capture radius R */
    'float deflection(float b, float m, float R) {',
    '  float weak = 4.0 * m / b + 11.780972 * m * m / (b * b);',
    '  float strong = -log(max(b / R - 1.0, 1e-3)) - 0.40023;',
    '  return min(max(weak, strong), 5.5);',
    '}',
    /* one hole, for the unbent ray: the shadow it covers, the bending it adds and the light it gathers.
       The two holes act on the same ray and their bendings add (a binary lens in one lens plane);
       applying them one after the other double-counts the bending and captures rays twice */
    'float lens(vec3 o, vec3 d, vec4 L, vec4 V, vec4 E, float pix, float kerr, inout vec3 bend, inout vec3 glow, inout float g, out float sOut) {',
    '  sOut = 1e9;',
    '  if (L.w <= 0.0) return 0.0;',
    '  vec3 toP = L.xyz - o;',
    '  float s = dot(toP, d);',
    '  if (s <= 0.0) return 0.0;',
    '  sOut = s;',
    '  vec3 bv = toP - d * s;',
    '  float R = V.w;',
    '  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), d) + vec3(1e-4, 0.0, 0.0));',
    '  vec3 bk = bv - side * (kerr * 0.14 * R);',                 /* Kerr: shadow displaced, flattened on one side */
    '  float along = dot(bk, E.xyz);',
    '  vec3 perp = bk - E.xyz * along;',
    '  float bEff = sqrt(along * along / ((1.0 + E.w) * (1.0 + E.w)) + dot(perp, perp));',
    '  bEff /= 1.0 - kerr * 0.07 * max(dot(normalize(bk + vec3(1e-5)), side), 0.0);',
    '  float b = max(length(bv), 1e-4);',
    '  float fp = s * pix;',
    '  float cover = 1.0 - smoothstep(R - 1.2 * fp, R + 0.6 * fp, bEff);',
    '  float a = deflection(max(bEff, R * 1.0005), L.w, R);',
    '  vec3 bh = bv / b;',
    '  bend += (cos(a) - 1.0) * d + sin(a) * bh;',
    '  vec3 dn = normalize(cos(a) * d + sin(a) * bh);',
    '  float gi = clamp(1.0 + dot(V.xyz, d - dn), 0.7, 1.45);',   /* moving lens: photon energy shift ~ v.(d_in - d_out) */
    '  g *= gi;',
    '  float ringW = max(0.035 * R, fp);',
    '  float ring = exp(-(bEff - R) * (bEff - R) / (ringW * ringW));',
    '  float halo = exp(-max(bEff - R, 0.0) / (0.45 * R));',
    '  glow += (vec3(1.0, 0.88, 0.70) * ring * 0.8 + vec3(0.62, 0.70, 0.82) * halo * 0.018) * gi * gi * gi * (1.0 - cover);',
    '  return cover;',
    '}',
    'vec3 sky(vec3 d, float pix, float g) {',
    '  float lon = atan(d.z, d.x);',
    '  float lat = asin(clamp(d.y, -1.0, 1.0));',
    '  vec3 gn = normalize(vec3(0.25, 0.9, 0.35));',
    '  float band = exp(-pow(dot(d, gn), 2.0) / 0.05);',
    '  float mott = 0.6 + 0.4 * sin(lon * 5.0 + sin(lat * 7.0) * 1.7) * sin(lat * 11.0 + lon * 3.0);',
    '  vec3 col = vec3(0.020, 0.024, 0.032) * band * mott + vec3(0.004, 0.005, 0.007);',
    '  for (int k = 0; k < NLAYER; k++) {',
    '    float sc = k == 0 ? 90.0 : (k == 1 ? 240.0 : 520.0);',
    '    float thr = k == 0 ? 0.994 : (k == 1 ? 0.988 : 0.986);',
    '    float gain = k == 0 ? 1.0 : (k == 1 ? 0.55 : 0.28);',
    '    vec2 uv = vec2(lon, lat) * sc;',
    '    vec2 id = floor(uv);',
    '    float h = hash12(id + float(k) * 17.0);',
    '    if (h > thr) {',
    '      vec2 jit = vec2(hash12(id + 3.1), hash12(id + 7.7)) - 0.5;',
    '      vec2 fc = fract(uv) - 0.5 - jit * 0.6;',
    '      float rad = max(pix * sc * 0.75, 0.035);',
    '      float lum = pow((h - thr) / (1.0 - thr), 2.0) * gain;',
    '      vec3 tint = mix(vec3(0.72, 0.80, 1.0), vec3(1.0, 0.85, 0.66), hash12(id + 11.3));',
    '      col += tint * lum * exp(-dot(fc, fc) / (rad * rad));',
    '    }',
    '  }',
    '  vec3 shift = mix(vec3(1.0, 0.78, 0.60), vec3(0.80, 0.88, 1.0), clamp((g - 1.0) * 2.0 + 0.5, 0.0, 1.0));',
    '  return col * shift * min(g * g * g * g, 6.0);',
    '}',
    'vec3 plane(vec3 o, vec3 d, float pix) {',
    '  if (abs(d.y) < 1e-4) return vec3(0.0);',
    '  float tp = -o.y / d.y;',
    '  if (tp <= 0.0) return vec3(0.0);',
    '  vec3 q = o + d * tp;',
    '  float r = length(q.xz);',
    '  float ang = atan(q.z, q.x);',
    '  float fp = tp * pix / max(abs(d.y), 0.06);',
    '  vec4 w = texture2D(uWave, vec2((uT - r * uTM - uWG.x) / uWG.y, 0.5));',
    '  vec2 cs = w.gb * 2.0 - 1.0;',
    '  cs /= max(length(cs), 1e-3);',
    '  float f = w.a * 300.0;',
    '  float c2 = cos(2.0 * ang); float s2 = sin(2.0 * ang);',
    '  float hp = cs.x * c2 + cs.y * s2;',                           /* cos(Phi - 2 phi) at retarded time */
    '  float hs = cs.y * c2 - cs.x * s2;',                           /* sin(Phi - 2 phi) */
    '  float dph = 2.0 * PI * f * uTM * fp + 2.0 * fp / max(r, 1.0);',
    '  float aa = 1.0 - smoothstep(0.5, 2.5, dph);',
    '  float nearZ = smoothstep(0.6 * uSep + 2.0, 1.6 * uSep + 9.0, r);',
    '  float amp = pow(w.r, 0.7) * nearZ * exp(-r / 240.0);',
    '  float lap = 1.0 - 2.0 * uLA.w / max(length(q - uLA.xyz), 0.5) - 2.0 * uLB.w / max(length(q - uLB.xyz), 0.5);',
    '  float lapse = sqrt(clamp(lap, 0.0, 1.0));',
    '  vec3 warm = vec3(1.0, 0.66, 0.26);',
    '  vec3 cool = vec3(0.40, 0.52, 0.68);',
    /* a wavefront that spans hundreds of pixels (seen close, from above) is dimmed, so crests read as lines */
    '  float lamPx = 1.0 / max(f * uTM * fp, 1e-4);',
    '  float wide = mix(1.0, 0.42, smoothstep(60.0, 420.0, lamPx));',
    '  float crest = pow(max(hp, 0.0), 18.0) * wide;',
    '  float trough = pow(max(-hp, 0.0), 18.0) * wide;',
    '  vec3 col = warm * (0.035 * max(hp, 0.0) + 0.60 * crest * aa) + cool * (0.028 * max(-hp, 0.0) + 0.32 * trough * aa);',
    '  col *= amp * (1.0 + 1.6 * uBurst * exp(-r / 14.0));',
    '#ifdef GRID',
    '  vec2 tang = vec2(-sin(ang), cos(ang));',
    '  vec2 gq = q.xz + tang * (1.4 * amp * hs);',                    /* transverse displacement along the wavefront */
    '  vec2 gd = abs(fract(gq / 5.0 + 0.5) - 0.5) * 5.0;',
    '  float lw = max(0.05, 0.8 * fp);',
    '  float gl = max(1.0 - smoothstep(0.0, lw, gd.x), 1.0 - smoothstep(0.0, lw, gd.y));',
    '  gl *= (1.0 - smoothstep(0.08, 0.35, fp / 5.0)) * exp(-r / 150.0);',
    '  col += vec3(0.50, 0.58, 0.70) * gl * mix(0.030, 0.13, uMode);',
    '#endif',
    '  float rw = max(0.08, 1.1 * fp);',
    '  float rings = (1.0 - smoothstep(0.0, rw, abs(r - 10.0))) + (1.0 - smoothstep(0.0, rw, abs(r - 20.0))) + (1.0 - smoothstep(0.0, rw, abs(r - 40.0)));',
    '  col += warm * rings * 0.22 * uMode;',
    '  return col * lapse * exp(-tp / 420.0);',
    '}',
    'void main() {',
    '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y) - uShift;',
    '  vec3 d = normalize(uF * uFocal + uR * p.x + uU * p.y);',
    '  vec3 o = uCam;',
    '  float pix = 1.0 / (0.5 * uRes.y * uFocal);',
    '  vec3 bend = vec3(0.0); vec3 glowA = vec3(0.0); vec3 glowB = vec3(0.0);',
    '  float g = 1.0; float sA; float sB;',
    '  vec4 E0 = vec4(1.0, 0.0, 0.0, 0.0);',
    '  float covA = lens(o, d, uLA, uVA, uEA, pix, uKerr, bend, glowA, g, sA);',
    '  float covB = lens(o, d, uLB, uVB, E0, pix, 0.0, bend, glowB, g, sB);',
    '  float open = (1.0 - covA) * (1.0 - covB);',
    '  vec3 dl = normalize(d + bend);',
    '  float sNear = min(sA, sB);',
    '  float tp0 = abs(d.y) > 1e-4 ? -o.y / d.y : -1.0;',
    '  bool planeFirst = tp0 > 0.0 && tp0 < sNear;',
    '  vec3 front = vec3(0.0);',
    '  vec3 behind = vec3(0.0);',
    '  if (planeFirst) front = plane(o, d, pix) * (1.0 - 0.85 * max(covA, covB));',  /* keep the shadows black */
    '  else behind = plane(sNear < 1e8 ? o + d * sNear : o, dl, pix);',
    '  vec3 glow = glowA * (1.0 - covB) + glowB * (1.0 - covA);',
    '  vec3 col = (sky(dl, pix, g) + behind) * open + glow * (0.85 + 1.4 * uBurst) + front;',
    '  col *= 1.25;',
    '  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);',
    '  vec2 v = gl_FragCoord.xy / uRes - 0.5;',
    '  col *= 1.0 - 0.55 * dot(v, v);',
    '  col = pow(max(col, vec3(0.0)), vec3(0.4545));',
    '  col += (hash12(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) / 255.0;',
    '  gl_FragColor = vec4(col * uFade, 1.0);',
    '}'
  ].join('\n');
  var VS_TRI = 'attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }';
  var VS_LINE = [
    'attribute vec4 aP; uniform vec3 uCam; uniform vec3 uF; uniform vec3 uR; uniform vec3 uU;',
    'uniform float uFocal; uniform float uAspect; uniform vec2 uShift; varying float vT;',
    'void main() {',
    '  vec3 v = aP.xyz - uCam; float z = max(dot(v, uF), 0.01);',
    '  vec2 s = vec2(dot(v, uR), dot(v, uU)) / z * uFocal;',
    '  gl_Position = vec4((s.x + uShift.x) / uAspect, s.y + uShift.y, 0.0, 1.0); vT = aP.w;',
    '}'
  ].join('\n');
  var FS_LINE = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform float uNow; uniform float uMode; uniform vec3 uColor; varying float vT;',
    'void main() { float a = smoothstep(uNow - 0.08, uNow, vT) * step(vT, uNow) * uMode * 0.8; gl_FragColor = vec4(uColor, a); }'
  ].join('\n');

  function HeroScene(section) {
    Scene.call(this, section);
    this.stage = section;
    this.canvas = section.querySelector('.ovh-gl');
    this.wave = section.querySelector('.ovh-wave canvas');
    this.wctx = this.wave ? this.wave.getContext('2d') : null;
    this.hud = hudOf(section.querySelector('.ovh-hud'));
    this.ledger = null;
    this.tip = section.querySelector('.ovh-tip');
    this.pauseBtn = section.querySelector('.ovh-pause');
    this.modeBtns = section.querySelectorAll('.ovh-modes button');
    this.labels = section.querySelectorAll('.ovh-labels span');
    this.S = newState();
    this.cam = { pos: new Float32Array(3), f: new Float32Array(3), r: new Float32Array(3), u: new Float32Array(3), focal: 1.9, sx: 0, sy: 0 };
    this.user = { az: 0, el: 0, zoom: 1, mx: 0, my: 0, pxe: 0, pye: 0 };
    this.mode = 'cinematic'; this.modeMix = 0; this.drift = 0; this.lastE = 0; this.clk = heroClock(0);
    this.quality = 1; this.ema = 16; this.lastNow = 0; this.mouse = null; this.drag = null;
    this.mobile = !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches);
    this.renderer = this.initGL() ? 'webgl' : (this.init2d() ? '2d' : 'none');
    mark('render', this.renderer);
    this.bind();
    this.layout();
    this.setMode(this.mode);
  }
  HeroScene.prototype = Object.create(Scene.prototype);

  HeroScene.prototype.compile = function (gl, vs, fs) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error('shader: ' + gl.getShaderInfoLog(s)); }
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 0, 'aP');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
  };
  HeroScene.prototype.initGL = function () {
    var self = this, cv = this.canvas, gl = null;
    var opts = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false,
                 preserveDrawingBuffer: FIXED !== null || REDUCE, powerPreference: 'high-performance' };
    try { gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts); } catch (e) { gl = null; }
    if (!gl) return false;
    try {
      var defs = '#define NLAYER ' + (this.mobile ? 2 : 3) + '\n' + (this.mobile ? '' : '#define GRID\n');
      this.prog = this.compile(gl, VS_TRI, defs + FS_HERO);
      this.lineProg = this.compile(gl, VS_LINE, FS_LINE);
    } catch (err) { mark('error', String(err.message).slice(0, 300)); return false; }
    this.gl = gl;
    var U = this.uni = {};
    ['uRes', 'uCam', 'uF', 'uR', 'uU', 'uFocal', 'uShift', 'uT', 'uTM', 'uSep', 'uMode', 'uBurst', 'uFade', 'uKerr', 'uTime',
     'uWave', 'uWG', 'uLA', 'uLB', 'uVA', 'uVB', 'uEA'].forEach(function (n) { U[n] = gl.getUniformLocation(self.prog, n); });
    var L = this.lineUni = {};
    ['uCam', 'uF', 'uR', 'uU', 'uFocal', 'uAspect', 'uShift', 'uNow', 'uMode', 'uColor'].forEach(function (n) { L[n] = gl.getUniformLocation(self.lineProg, n); });
    this.tri = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tri);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    /* the signal as a texture: amplitude, cos and sin of the GW phase, frequency, on the data grid */
    var n = G.n, stride = Math.max(1, Math.ceil(n / gl.getParameter(gl.MAX_TEXTURE_SIZE))), m = Math.ceil(n / stride);
    var px = new Uint8Array(m * 4), k, j;
    for (j = 0; j < m; j++) {
      k = Math.min(n - 1, j * stride);
      px[4 * j] = Math.round(clamp(D.amp[k], 0, 1) * 255);
      px[4 * j + 1] = Math.round((0.5 + 0.5 * Math.cos(D.phase[k])) * 255);
      px[4 * j + 2] = Math.round((0.5 + 0.5 * Math.sin(D.phase[k])) * 255);
      px[4 * j + 3] = Math.round(clamp(D.freq[k] / 300, 0, 1) * 255);
    }
    this.texGrid = [G.t0 - 0.5 * G.dt * stride, m * G.dt * stride];
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, m, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    /* the two trajectories, drawn in scientific mode from the same state function */
    var pts = [], S = newState(), t, count = 0;
    for (var pass = 0; pass < 2; pass++) {
      for (k = 0; k < n; k++) {
        t = G.t0 + k * G.dt;
        if (t < -0.30 || t > 0) continue;
        heroState(t, S);
        var src = pass ? S.LB : S.LA;
        pts.push(src[0], 0.02, src[2], t);
        if (!pass) count++;
      }
    }
    this.lineCount = count;
    this.lines = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lines);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    cv.addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); self.glLost = true; mark('render', 'lost'); });
    cv.addEventListener('webglcontextrestored', function () { self.glLost = false; if (self.initGL()) { mark('render', 'webgl'); self.poke(); } });
    return true;
  };
  HeroScene.prototype.init2d = function () {
    try { this.ctx2d = this.canvas.getContext('2d'); } catch (e) { this.ctx2d = null; }
    return !!this.ctx2d;
  };

  HeroScene.prototype.bind = function () {
    var self = this, st = this.stage;
    Array.prototype.forEach.call(this.modeBtns, function (b) {
      b.addEventListener('click', function () { self.setMode(b.getAttribute('data-mode')); });
    });
    if (this.pauseBtn) this.pauseBtn.addEventListener('click', function () { self.togglePause(); });
    function local(ev) { var r = st.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top, w: r.width, h: r.height }; }
    st.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || (ev.target.closest && ev.target.closest('button, a'))) return;
      self.drag = { x: ev.clientX, y: ev.clientY, az: self.user.az, el: self.user.el, at: performance.now(), moved: false };
      try { st.setPointerCapture(ev.pointerId); } catch (e) { /* not capturable */ }
    });
    st.addEventListener('pointermove', function (ev) {
      var p = local(ev);
      self.mouse = p;
      self.user.mx = clamp(p.x / p.w * 2 - 1, -1, 1); self.user.my = clamp(p.y / p.h * 2 - 1, -1, 1);
      if (self.drag) {
        var dx = ev.clientX - self.drag.x, dy = ev.clientY - self.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) { self.drag.moved = true; st.classList.add('dragging'); }
        self.user.az = self.drag.az - dx * 0.006;
        self.user.el = clamp(self.drag.el + dy * 0.004, -0.34, 0.95);
      }
      self.poke();
    });
    function end(ev) {
      var d = self.drag;
      self.drag = null; st.classList.remove('dragging');
      if (d && ev.type === 'pointerup' && !d.moved && performance.now() - d.at < 350) self.togglePause();
    }
    st.addEventListener('pointerup', end);
    st.addEventListener('pointercancel', end);
    st.addEventListener('pointerleave', function () { self.mouse = null; self.user.mx = 0; self.user.my = 0; self.showTip(null); self.poke(); });
    var relayout = function () { self.layout(); self.poke(); };
    if (window.ResizeObserver) new ResizeObserver(relayout).observe(st);
    window.addEventListener('resize', relayout);
  };
  HeroScene.prototype.layout = function () {
    this.mobile = !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches);
    this.stripBase();
  };
  HeroScene.prototype.onStart = function () { this.layout(); this.syncPause(); };
  HeroScene.prototype.onStop = function () { this.showTip(null); };
  HeroScene.prototype.poke = function () {
    if (this.raf && !this.paused) return;
    if (this.raf && this.paused) { this.dirty = true; return; }
    if (this.running) this.redraw();
  };
  HeroScene.prototype.redraw = function () { this.render(this.lastE, 0); };
  HeroScene.prototype.togglePause = function () {
    if (FIXED !== null) return;
    Scene.prototype.togglePause.call(this);
    this.syncPause();
  };
  HeroScene.prototype.syncPause = function () {
    var p = !!this.paused;
    this.stage.setAttribute('data-paused', p ? 'true' : 'false');
    if (this.pauseBtn) {
      this.pauseBtn.setAttribute('aria-pressed', p ? 'true' : 'false');
      this.pauseBtn.textContent = p ? 'Play' : 'Pause';
      this.pauseBtn.setAttribute('aria-label', p ? 'Resume the animation' : 'Pause the animation');
    }
  };
  HeroScene.prototype.jump = function (t) {
    var e = heroE(t);
    this.lastE = e;
    if (FIXED !== null || REDUCE || !this.raf) { this.redraw(); return; }
    this.t0 = performance.now() - e * 1000;
    if (this.paused) this.pauseAt = performance.now();
    this.dirty = true;                          /* a pause right after the jump still shows the new instant */
  };
  HeroScene.prototype.reset = function () {
    this.user.az = 0; this.user.el = 0; this.user.zoom = 1; this.drift = 0;
    if (this.paused) this.togglePause();
    this.jump(HT.t0);
  };
  HeroScene.prototype.setMode = function (m) {
    this.mode = m === 'scientific' ? 'scientific' : 'cinematic';
    this.stage.setAttribute('data-mode', this.mode);
    Array.prototype.forEach.call(this.modeBtns, function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-mode') === m ? 'true' : 'false');
    });
    if (!this.raf || this.paused) this.modeMix = this.mode === 'scientific' ? 1 : 0;
    this.stripBase();
    this.poke();
  };

  HeroScene.prototype.frame = function (e) {
    var dt = FIXED !== null ? 0 : clamp(e - this.lastE, 0, 0.1), now = performance.now();
    /* resolution follows missed frames: rAF is capped at the display rate, so a steady interval under
       18 ms means headroom, over 22 ms means the GPU is behind. The first 90 frames (shader compile,
       page load) are ignored. */
    if (this.lastNow && this.frames > 90) {
      var gap = now - this.lastNow;
      this.ema = 0.92 * this.ema + 0.08 * gap;
      this.calm = gap < 18 ? (this.calm || 0) + 1 : 0;
      if (this.frames % 45 === 44 && this.ema > 22 && this.quality > 0.5) { this.quality = Math.max(0.5, this.quality - 0.1); this.calm = 0; }
      else if (this.calm > 90 && this.quality < 1) { this.quality = Math.min(1, this.quality + 0.05); this.calm = 0; }
    }
    this.lastNow = now;
    this.lastE = e;
    this.render(e, dt);
  };
  HeroScene.prototype.render = function (e, dt) {
    var clk = this.clk = heroClock(e), S = heroState(clk.t, this.S), u = this.user;
    var target = this.mode === 'scientific' ? 1 : 0;
    this.modeMix += (target - this.modeMix) * (dt > 0 ? Math.min(1, dt * 4) : 1);
    this.drift += dt * (0.03 - 0.022 * this.modeMix);
    u.pxe += (u.mx - u.pxe) * (dt > 0 ? Math.min(1, dt * 3) : 1);
    u.pye += (u.my - u.pye) * (dt > 0 ? Math.min(1, dt * 3) : 1);
    this.camera(S, e);
    if (this.gl && !this.glLost) this.drawGL(S, clk, e); else if (this.ctx2d) this.draw2d(S, clk);
    this.hudAt(S, clk);
    this.stripCursor(S.t);
    this.placeLabels();
    if (this.mouse && !this.drag) this.hover(this.mouse.x, this.mouse.y); else if (!this.mouse) this.showTip(null);
  };
  HeroScene.prototype.camera = function (S, e) {
    var u = this.user, cam = this.cam, sci = this.modeMix;
    var approach = sstep(-0.06, -0.002, S.t), settle = sstep(0.002, 0.05, S.t);
    var dist = (this.mobile ? 64 : 46) * (1 - 0.22 * approach + 0.16 * settle) * u.zoom;
    var az = 0.6 + u.az + this.drift + u.pxe * 0.07;
    var el = clamp(0.40 + u.el - u.pye * 0.05 + 0.28 * sci, 0.06, 1.35);
    var shake = S.burst * 0.28 * (1 - sci) * (REDUCE ? 0 : 1);
    var tx = shake * Math.sin(e * 57.0), ty = shake * Math.sin(e * 43.0 + 1.3);
    var P = cam.pos, F = cam.f, R = cam.r, U = cam.u;
    P[0] = tx + dist * Math.cos(el) * Math.sin(az); P[1] = ty + dist * Math.sin(el); P[2] = dist * Math.cos(el) * Math.cos(az);
    F[0] = tx - P[0]; F[1] = ty - P[1]; F[2] = -P[2];
    var fl = Math.sqrt(F[0] * F[0] + F[1] * F[1] + F[2] * F[2]); F[0] /= fl; F[1] /= fl; F[2] /= fl;
    R[0] = -F[2]; R[1] = 0; R[2] = F[0];
    var rl = Math.sqrt(R[0] * R[0] + R[2] * R[2]); R[0] /= rl; R[2] /= rl;
    U[0] = R[1] * F[2] - R[2] * F[1]; U[1] = R[2] * F[0] - R[0] * F[2]; U[2] = R[0] * F[1] - R[1] * F[0];
    var W = this.stage.clientWidth || 1, H = this.stage.clientHeight || 1, aspect = W / H;
    cam.focal = this.mobile ? 1.7 : 1.9;
    cam.sx = this.mobile ? 0 : 0.28 * aspect; cam.sy = this.mobile ? -0.30 : -0.05;
  };
  HeroScene.prototype.fitCanvas = function (dprMax, budget) {
    var cv = this.canvas, cw = cv.clientWidth, ch = cv.clientHeight;
    if (!cw || !ch) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, dprMax);
    var s = Math.min(1, Math.sqrt(budget / (cw * ch * dpr * dpr))) * this.quality;
    var w = Math.max(1, Math.round(cw * dpr * s)), h = Math.max(1, Math.round(ch * dpr * s));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return true;
  };
  HeroScene.prototype.drawGL = function (S, clk, e) {
    var gl = this.gl, U = this.uni, cam = this.cam;
    if (!this.fitCanvas(2, this.mobile ? 0.55e6 : 2.1e6)) return;
    var W = this.canvas.width, H = this.canvas.height;
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tri);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(U.uWave, 0);
    gl.uniform2f(U.uRes, W, H);
    gl.uniform3fv(U.uCam, cam.pos); gl.uniform3fv(U.uF, cam.f); gl.uniform3fv(U.uR, cam.r); gl.uniform3fv(U.uU, cam.u);
    gl.uniform1f(U.uFocal, cam.focal); gl.uniform2f(U.uShift, cam.sx, cam.sy);
    gl.uniform1f(U.uT, S.t); gl.uniform1f(U.uTM, D.scale.tM_det_s); gl.uniform1f(U.uSep, S.sep);
    gl.uniform1f(U.uMode, this.modeMix); gl.uniform1f(U.uBurst, S.burst * (1 - 0.5 * this.modeMix));
    gl.uniform1f(U.uFade, REDUCE || FIXED !== null ? 1 : clk.fade); gl.uniform1f(U.uKerr, S.kerr); gl.uniform1f(U.uTime, e);
    gl.uniform3f(U.uWG, this.texGrid[0], this.texGrid[1], 0);
    gl.uniform4fv(U.uLA, S.LA); gl.uniform4fv(U.uLB, S.LB); gl.uniform4fv(U.uVA, S.VA); gl.uniform4fv(U.uVB, S.VB);
    gl.uniform4fv(U.uEA, S.EA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (this.modeMix > 0.01) {
      var L = this.lineUni;
      gl.useProgram(this.lineProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lines);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.uniform3fv(L.uCam, cam.pos); gl.uniform3fv(L.uF, cam.f); gl.uniform3fv(L.uR, cam.r); gl.uniform3fv(L.uU, cam.u);
      gl.uniform1f(L.uFocal, cam.focal); gl.uniform1f(L.uAspect, W / H); gl.uniform2f(L.uShift, cam.sx, cam.sy);
      gl.uniform1f(L.uNow, S.t); gl.uniform1f(L.uMode, this.modeMix);
      gl.uniform3f(L.uColor, 0.90, 0.64, 0.26); gl.drawArrays(gl.LINE_STRIP, 0, this.lineCount);
      gl.uniform3f(L.uColor, 0.56, 0.66, 0.78); gl.drawArrays(gl.LINE_STRIP, this.lineCount, this.lineCount);
      gl.disable(gl.BLEND);
    }
  };
  /* without WebGL: the same state seen from above, drawn on a 2D canvas */
  HeroScene.prototype.draw2d = function (S, clk) {
    if (!this.fitCanvas(1.5, 0.8e6)) return;
    var cv = this.canvas, ctx = this.ctx2d, W = cv.width, H = cv.height, N = 150, i, j;
    if (!this.fb) {
      this.fb = document.createElement('canvas'); this.fb.width = this.fb.height = N;
      this.fbx = this.fb.getContext('2d'); this.fbi = this.fbx.createImageData(N, N);
    }
    var d = this.fbi.data, tM = D.scale.tM_det_s, span = 60;
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      var x = ((i + 0.5) / N * 2 - 1) * span, y = ((j + 0.5) / N * 2 - 1) * span, r = Math.sqrt(x * x + y * y), p = 4 * (j * N + i);
      var tr = S.t - r * tM, A = Math.pow(table(D.amp, tr), 0.7) * sstep(0.6 * S.sep + 2, 1.6 * S.sep + 9, r);
      var v = A * Math.cos(table(D.phase, tr) - 2 * Math.atan2(y, x)), a = Math.min(1, Math.abs(v)) * (r < span ? 1 : 0);
      if (v > 0) { d[p] = 255; d[p + 1] = 168; d[p + 2] = 66; } else { d[p] = 102; d[p + 1] = 133; d[p + 2] = 173; }
      d[p + 3] = Math.round(a * 150);
    }
    this.fbx.putImageData(this.fbi, 0, 0);
    ctx.fillStyle = '#05070b'; ctx.fillRect(0, 0, W, H);
    var cx = W / 2 + this.cam.sx * H / 2, cy = H / 2 - this.cam.sy * H / 2, R = Math.min(W * 0.42, H * 0.46), k = R / span;
    ctx.globalAlpha = clk.fade; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fb, cx - R, cy - R, 2 * R, 2 * R);
    function hole(L, V) {
      if (L[3] <= 0) return;
      ctx.beginPath(); ctx.arc(cx + L[0] * k, cy + L[2] * k, Math.max(2, V[3] * k), 0, 2 * Math.PI);
      ctx.fillStyle = '#000'; ctx.fill(); ctx.strokeStyle = 'rgba(255,224,178,0.75)'; ctx.lineWidth = 1; ctx.stroke();
    }
    hole(S.LA, S.VA); hole(S.LB, S.VB);
    ctx.globalAlpha = 1;
  };
  HeroScene.prototype.project = function (x, y, z) {
    var c = this.cam, vx = x - c.pos[0], vy = y - c.pos[1], vz = z - c.pos[2];
    var zc = vx * c.f[0] + vy * c.f[1] + vz * c.f[2];
    if (zc <= 0.1) return null;
    var sx = (vx * c.r[0] + vy * c.r[1] + vz * c.r[2]) / zc * c.focal, sy = (vx * c.u[0] + vy * c.u[1] + vz * c.u[2]) / zc * c.focal;
    var W = this.stage.clientWidth, H = this.stage.clientHeight;
    if (this.renderer !== 'webgl') return { x: W / 2 + c.sx * H / 2 + x * Math.min(W * 0.42, H * 0.46) / 60, y: H / 2 - c.sy * H / 2 + z * Math.min(W * 0.42, H * 0.46) / 60, k: Math.min(W * 0.42, H * 0.46) / 60 };
    return { x: (sx + c.sx) * H / 2 + W / 2, y: H / 2 - (sy + c.sy) * H / 2, k: c.focal * H / 2 / zc };
  };
  HeroScene.prototype.hover = function (mx, my) {
    var S = this.S, best = null, self = this;
    function test(L, V, key) {
      if (L[3] <= 0) return;
      var p = self.project(L[0], L[1], L[2]);
      if (!p) return;
      var dd = Math.sqrt((mx - p.x) * (mx - p.x) + (my - p.y) * (my - p.y)), lim = Math.max(1.25 * V[3] * p.k, 18);
      if (dd < lim && (!best || dd < best.d)) best = { d: dd, key: key };
    }
    test(S.LA, S.VA, S.t < 0 ? 'bh1' : 'rem');
    if (S.t < 0) test(S.LB, S.VB, 'bh2');
    if (!best) { this.showTip(null); return; }
    var txt = D.tips[best.key];
    if (best.key !== 'rem' && S.t < -0.004) {
      var HZ = D.horizons, share = best.key === 'bh1' ? HZ.m2 / (HZ.m1 + HZ.m2) : HZ.m1 / (HZ.m1 + HZ.m2);
      txt += ' · speed ≈ ' + (S.vc * share).toFixed(2) + ' c (Newtonian)';
    }
    this.showTip(txt, mx, my);
  };
  HeroScene.prototype.showTip = function (txt, x, y) {
    var tip = this.tip;
    if (!tip) return;
    if (!txt) { if (!tip.hidden) tip.hidden = true; return; }
    setText(tip, txt);
    tip.hidden = false;
    var W = this.stage.clientWidth, w = tip.offsetWidth || 240;
    tip.style.left = Math.min(x + 14, W - w - 12) + 'px';
    tip.style.top = (y + 16) + 'px';
  };
  HeroScene.prototype.placeLabels = function () {
    var mix = this.modeMix, c = this.cam, n = this.labels.length, i;
    if (!n) return;
    var dx = c.f[0], dz = c.f[2], dl = Math.sqrt(dx * dx + dz * dz) || 1;   /* far side of each ring: above the holes, clear of the text */
    for (i = 0; i < n; i++) {
      var el = this.labels[i], rr = parseFloat(el.getAttribute('data-r')), p = this.project(dx / dl * rr, 0, dz / dl * rr);
      if (!p || mix < 0.02) { el.style.opacity = '0'; continue; }
      el.style.opacity = String(Math.min(1, mix) * 0.9);
      el.style.transform = 'translate(' + (p.x + 4).toFixed(1) + 'px,' + (p.y - 14).toFixed(1) + 'px)';
    }
  };
  HeroScene.prototype.hudAt = function (S, clk) {
    var h = this.hud, t = S.t, ph = phaseName(t);
    setText(h.t, fmtT(t));
    setText(h.f, Math.round(S.f) + ' Hz');
    setText(h.r, t < 0 ? (S.sep > 0.05 ? '≈ ' + Math.round(S.sep * D.scale.rg_src_km / 10) * 10 + ' km' : 'touching') : 'one horizon');
    setText(h.v, t < 0 ? '≈ ' + S.vc.toFixed(2) : '—');
    setText(h.phase, ph);
    setText(h.slow, '×' + Math.round(clk.slow));
    if (this.stage.getAttribute('data-phase') !== ph) this.stage.setAttribute('data-phase', ph);
    if (this.ledger) this.ledger.setAttribute('data-state', t >= 0 ? 'after' : 'before');
  };
  /* the waveform strip: the Livingston record, drawn once per size and mode; the cursor per frame */
  HeroScene.prototype.stripBase = function () {
    var cv = this.wave, s = D.strip;
    if (!cv || !s) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, Hh = cv.clientHeight, i;
    if (!W || !Hh) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
    var base = this.waveBase || (this.waveBase = document.createElement('canvas'));
    base.width = cv.width; base.height = cv.height;
    var c = base.getContext('2d'), sci = this.mode === 'scientific';
    var X = function (t) { return (t - SW0) / (SW1 - SW0) * W; }, Y = function (v) { return Hh * 0.5 - v / 15 * (Hh * 0.5 - 4); };
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, Hh);
    c.strokeStyle = 'rgba(231,237,245,0.08)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, Hh * 0.5); c.lineTo(W, Hh * 0.5); c.stroke();
    c.beginPath();
    for (i = 0; i < s.tr.length; i++) c.lineTo(X(s.tr[i]), Y(s.hi[i]));
    for (i = s.tr.length - 1; i >= 0; i--) c.lineTo(X(s.tr[i]), Y(s.lo[i]));
    c.closePath(); c.fillStyle = 'rgba(229,163,67,0.17)'; c.fill();
    c.beginPath();
    for (i = 0; i < s.t.length; i++) c.lineTo(X(s.t[i]), Y(s.data[i]));
    c.strokeStyle = 'rgba(152,168,190,0.40)'; c.lineWidth = 0.8; c.stroke();
    c.beginPath();
    for (i = 0; i < s.tr.length; i++) c.lineTo(X(s.tr[i]), Y(s.rec[i]));
    c.strokeStyle = 'rgba(229,163,67,0.95)'; c.lineWidth = 1.2; c.stroke();
    c.setLineDash([3, 3]); c.strokeStyle = 'rgba(231,237,245,0.30)';
    c.beginPath(); c.moveTo(X(0), 0); c.lineTo(X(0), Hh); c.stroke(); c.setLineDash([]);
    if (sci) {
      c.font = '9px "IBM Plex Mono", ui-monospace, monospace'; c.fillStyle = 'rgba(152,168,190,0.75)'; c.textBaseline = 'bottom';
      [-0.2, -0.1].forEach(function (v) { c.fillText(v.toFixed(1) + ' s', X(v) + 3, Hh - 1); c.fillRect(X(v), Hh - 5, 1, 5); });
      c.fillText('0', X(0) + 3, Hh - 1);
      c.textBaseline = 'top'; c.fillStyle = 'rgba(229,163,67,0.85)';
      c.fillText('inspiral', X(-0.25), 1); c.fillText('merger', X(0) + 4, 1); c.fillText('ringdown', X(0.012), 1);
    }
    this.stripDpr = dpr;
  };
  HeroScene.prototype.stripCursor = function (t) {
    var cv = this.wave, c = this.wctx, s = D.strip;
    if (!cv || !c || !this.waveBase || !cv.width) return;
    var dpr = this.stripDpr || 1, W = cv.width / dpr, Hh = cv.height / dpr, x = (t - SW0) / (SW1 - SW0) * W;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.drawImage(this.waveBase, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = 'rgba(5,7,11,0.62)'; c.fillRect(x, 0, W - x, Hh);                 /* not yet recorded */
    c.fillStyle = '#E5A343'; c.fillRect(x - 0.75, 0, 1.5, Hh);
    var i = 0, n = s.tr.length;
    while (i < n - 1 && s.tr[i + 1] < t) i++;
    var v = i < n - 1 ? s.rec[i] + (s.rec[i + 1] - s.rec[i]) * clamp((t - s.tr[i]) / (s.tr[i + 1] - s.tr[i]), 0, 1) : 0;
    c.beginPath(); c.arc(x, Hh * 0.5 - v / 15 * (Hh * 0.5 - 4), 2.4, 0, 2 * Math.PI); c.fill();
  };
  HeroScene.prototype.renderStatic = function () {
    /* reduced motion: one meaningful instant, 6 ms before the peak, still explorable by drag and zoom */
    this.setMode(this.mode);
    this.lastE = heroE(-0.006);
    this.render(this.lastE, 0);
  };

  var scene = new HeroScene(stage);
  mark('ready', REDUCE ? 'static' : 'motion');
  return scene;
}
