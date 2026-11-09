// ── Theme toggle (light / dark) ────────────────────────────────────────────
(function initTheme() {
  const html = document.documentElement;
  const btn  = document.getElementById('theme-toggle');

  // Light = 'teal', Dark = 'dark-teal'
  const LIGHT = 'teal';
  const DARK  = 'dark-teal';

  function isDark() {
    const t = html.getAttribute('data-theme');
    return t === 'dark' || t === 'dark-teal';
  }

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('portfolio-theme', theme);
    window._particleThemeChanged = true;
  }

  // Restore saved preference, default to light teal
  const saved = localStorage.getItem('portfolio-theme');
  applyTheme(saved && saved !== '' ? saved : LIGHT);

  btn && btn.addEventListener('click', () => {
    applyTheme(isDark() ? LIGHT : DARK);
  });
})();

// ── Nav border on scroll ────────────────────────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── Reveal sections on scroll ──────────────────────────────────────────────
const revealObserver = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── Active nav link highlight ──────────────────────────────────────────────
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
      });
    }
  });
}, { rootMargin: '-30% 0px -60% 0px' });

sections.forEach(s => navObserver.observe(s));

// ── Typewriter effect ──────────────────────────────────────────────────────
(function initTypewriter() {
  const el = document.getElementById('typewriter');
  if (!el) return;
  const text = 'Data & AI Engineer · Toronto, Canada';
  let i = 0;

  function tick() {
    el.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(tick, i < 6 ? 80 : 38);
  }

  // Start after hero fade-in delay
  setTimeout(tick, 600);
})();

// ── Hero WebGL field ───────────────────────────────────────────────────────
(function initHeroShader() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stats = window.__heroShader = {
    webgl: false,
    reducedMotion: motionQuery.matches,
    fps: 0,
    dpr: 1,
    running: false
  };

  function hexToRgb(hex) {
    hex = (hex || '').trim();
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    const m = hex.match(/^#([0-9a-f]{6})$/i);
    if (!m) return null;
    return {
      r: parseInt(m[1].slice(0, 2), 16),
      g: parseInt(m[1].slice(2, 4), 16),
      b: parseInt(m[1].slice(4, 6), 16)
    };
  }

  function isDarkTheme() {
    const t = document.documentElement.getAttribute('data-theme') || '';
    return t === 'dark' || t === 'dark-teal';
  }

  // CSS mesh on the canvas is the fallback when WebGL cannot start.
  canvas.classList.add('hero-canvas-fallback');

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false
  });

  if (!gl) return;

  const VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  const FRAG = [
    'precision mediump float;',
    'uniform vec2 uResolution;',
    'uniform float uTime;',
    'uniform vec3 uAccent;',
    'uniform float uDark;',
    'uniform vec2 uPointer;',
    '',
    'float hash(vec2 p){',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
    '}',
    '',
    'float noise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float a = hash(i);',
    '  float b = hash(i + vec2(1.0, 0.0));',
    '  float c = hash(i + vec2(0.0, 1.0));',
    '  float d = hash(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
    '}',
    '',
    'float fbm(vec2 p){',
    '  float v = 0.0;',
    '  v += 0.65 * noise(p);',
    '  v += 0.35 * noise(p * 2.03);',
    '  return v;',
    '}',
    '',
    'float distSeg(vec2 p, vec2 a, vec2 b){',
    '  vec2 pa = p - a;',
    '  vec2 ba = b - a;',
    '  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);',
    '  return length(pa - ba * h);',
    '}',
    '',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uResolution;',
    '  uv.y = 1.0 - uv.y;',
    '  float aspect = uResolution.x / max(uResolution.y, 1.0);',
    '  vec2 p = vec2(uv.x * aspect, uv.y);',
    '  float t = uTime * 0.065;',
    '',
    '  vec2 q = vec2(',
    '    fbm(p * 1.15 + vec2(t, t * 0.35)),',
    '    fbm(p * 1.15 + vec2(5.2, 1.3) - t)',
    '  );',
    '  float n = fbm(p * 1.05 + 2.4 * q + vec2(0.0, t * 0.25));',
    '  float bands = smoothstep(0.32, 0.78, n);',
    '  float ridges = smoothstep(0.02, 0.0, abs(n - 0.55)) * 0.35;',
    '',
    '  float glow = 0.0;',
    '  glow += 0.62 * exp(-length((uv - vec2(0.78, 0.46)) * vec2(1.35, 1.15)) * 2.35);',
    '  glow += 0.28 * exp(-length((uv - vec2(0.18, 0.78)) * vec2(1.7, 1.35)) * 3.1);',
    '  glow += 0.16 * exp(-length((uv - vec2(0.52, 0.16)) * vec2(1.4, 1.6)) * 3.6);',
    '  glow += 0.18 * exp(-length(uv - uPointer) * 4.6);',
    '',
    '  float nodes = 0.0;',
    '  float links = 0.0;',
    '  vec2 prev = vec2(0.0);',
    '  for (int i = 0; i < 8; i++){',
    '    float fi = float(i);',
    '    vec2 seed = vec2(fi * 1.17 + 0.3, fi * 2.31 + 1.1);',
    '    vec2 pos = vec2(hash(seed), hash(seed + 7.1));',
    '    pos += 0.07 * vec2(sin(t * 1.15 + fi * 1.7), cos(t * 0.95 + fi * 2.2));',
    '    pos = mix(vec2(0.08), vec2(0.92), pos);',
    '    vec2 d = (uv - pos) * vec2(aspect, 1.0);',
    '    float dist = length(d);',
    '    float pulse = 0.55 + 0.45 * sin(t * 1.8 + fi * 1.9);',
    '    nodes += pulse * smoothstep(0.018, 0.0, dist);',
    '    nodes += 0.22 * pulse * smoothstep(0.09, 0.0, dist);',
    '    if (i > 0){',
    '      float ds = distSeg(uv * vec2(aspect, 1.0), prev * vec2(aspect, 1.0), pos * vec2(aspect, 1.0));',
    '      links += (0.35 + 0.25 * pulse) * smoothstep(0.006, 0.0, ds);',
    '    }',
    '    prev = pos;',
    '  }',
    '',
    '  vec3 accent = uAccent;',
    '  vec3 col;',
    '  float alpha;',
    '',
    '  float wellX = mix(0.50, 0.30, smoothstep(0.55, 1.25, aspect));',
    '  float well = smoothstep(0.70, 0.16, length((uv - vec2(wellX, 0.48)) * vec2(1.25, 0.9)));',
    '',
    '  if (uDark > 0.5){',
    '    vec3 deep = accent * 0.28;',
    '    col = mix(deep, accent, bands);',
    '    col += accent * glow * 0.55;',
    '    col += vec3(0.62, 0.92, 1.0) * (nodes * 0.65 + ridges * 0.25);',
    '    col += accent * links * 0.45;',
    '    alpha = 0.20 + 0.32 * bands + 0.28 * glow + nodes * 0.38 + links * 0.18;',
    '    alpha = min(alpha, 0.72);',
    '    alpha *= mix(1.0, 0.62, well);',
    '  } else {',
    '    col = mix(accent * 0.75, mix(accent, vec3(1.0), 0.22), bands);',
    '    col += accent * glow * 0.42;',
    '    col += accent * (nodes * 0.8 + ridges * 0.35 + links * 0.55);',
    '    alpha = 0.07 + 0.18 * bands + 0.20 * glow + nodes * 0.32 + links * 0.16;',
    '    alpha = min(alpha, 0.46);',
    '    alpha *= mix(1.0, 0.50, well);',
    '  }',
    '',
    '  gl_FragColor = vec4(col * alpha, alpha);',
    '}'
  ].join('\n');

  function makeShader(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('[hero-shader]', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = makeShader(gl.VERTEX_SHADER, VERT);
  const fs = makeShader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[hero-shader]', gl.getProgramInfoLog(program));
    return;
  }

  canvas.classList.remove('hero-canvas-fallback');
  canvas.classList.add('hero-canvas-webgl');
  stats.webgl = true;

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(program, 'aPos');
  const uResolution = gl.getUniformLocation(program, 'uResolution');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uAccent = gl.getUniformLocation(program, 'uAccent');
  const uDark = gl.getUniformLocation(program, 'uDark');
  const uPointer = gl.getUniformLocation(program, 'uPointer');

  gl.useProgram(program);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let accent = [0.051, 0.580, 0.533];
  let dark = 0;
  let pointer = [0.78, 0.46];
  let pointerTarget = [0.78, 0.46];
  let animId = 0;
  let inView = true;
  let pageVisible = !document.hidden;
  let reduced = motionQuery.matches;
  let lastT = 0;
  let fpsFrames = 0;
  let fpsStamp = 0;

  function readTheme() {
    const parsed = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--ha'));
    if (parsed) accent = [parsed.r / 255, parsed.g / 255, parsed.b / 255];
    dark = isDarkTheme() ? 1 : 0;
  }

  function capDpr() {
    const raw = window.devicePixelRatio || 1;
    const mobile = window.matchMedia('(max-width: 768px)').matches;
    return Math.min(raw, mobile ? 1.15 : 1.5);
  }

  function resize() {
    const dpr = capDpr();
    stats.dpr = dpr;
    const mobile = window.matchMedia('(max-width: 768px)').matches;
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    let w = Math.floor(cssW * dpr);
    let h = Math.floor(cssH * dpr);
    const maxPixels = mobile ? 160000 : 400000;
    const pixels = w * h;
    if (pixels > maxPixels) {
      const s = Math.sqrt(maxPixels / pixels);
      w = Math.max(1, Math.floor(w * s));
      h = Math.max(1, Math.floor(h * s));
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function shouldRun() {
    return stats.webgl && !reduced && inView && pageVisible;
  }

  function drawFrame(now) {
    if (window._particleThemeChanged) {
      readTheme();
      window._particleThemeChanged = false;
    }

    pointer[0] += (pointerTarget[0] - pointer[0]) * 0.045;
    pointer[1] += (pointerTarget[1] - pointer[1]) * 0.045;

    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now || 0) * 0.001);
    gl.uniform3f(uAccent, accent[0], accent[1], accent[2]);
    gl.uniform1f(uDark, dark);
    gl.uniform2f(uPointer, pointer[0], pointer[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    if (!shouldRun()) {
      animId = 0;
      stats.running = false;
      return;
    }
    stats.running = true;
    drawFrame(now);
    fpsFrames += 1;
    if (!fpsStamp) fpsStamp = now;
    if (now - fpsStamp >= 1000) {
      stats.fps = Math.round((fpsFrames * 1000) / (now - fpsStamp));
      fpsFrames = 0;
      fpsStamp = now;
    }
    lastT = now;
    animId = requestAnimationFrame(loop);
  }

  function start() {
    if (!animId && shouldRun()) {
      fpsFrames = 0;
      fpsStamp = 0;
      animId = requestAnimationFrame(loop);
    }
  }

  function stop() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = 0;
    }
    stats.running = false;
  }

  function renderStatic() {
    stop();
    resize();
    readTheme();
    drawFrame(0);
  }

  readTheme();
  resize();
  if (reduced) {
    renderStatic();
  } else {
    start();
  }

  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
    if (pageVisible) start();
    else stop();
  });

  const host = canvas.parentElement || canvas;
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((entries) => {
      inView = entries.some((e) => e.isIntersecting);
      if (inView) start();
      else stop();
    }, { threshold: 0.01 });
    io.observe(host);
  }

  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => {
      resize();
      if (!shouldRun()) drawFrame(lastT);
    });
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', () => {
      resize();
      if (!shouldRun()) drawFrame(lastT);
    }, { passive: true });
  }

  host.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerTarget = [
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height
    ];
  }, { passive: true });

  host.addEventListener('pointerleave', () => {
    pointerTarget = [0.78, 0.46];
  });

  const onMotionChange = (e) => {
    reduced = e.matches;
    stats.reducedMotion = reduced;
    if (reduced) renderStatic();
    else start();
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
  else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);

  new MutationObserver(() => {
    readTheme();
    if (!shouldRun()) drawFrame(lastT);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
