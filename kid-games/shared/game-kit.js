// Shared helpers for the hand-written kid games (dots, match, memory) and the
// kid-games index page.

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Random, non-repeating round order: `count` picks out of `length` items.
export function pickRoundOrder(length, count) {
  return shuffle(Array.from({ length }, (_, i) => i)).slice(0, count);
}

let speechReady = false;

// Browsers only allow speech after a user gesture; a silent utterance unlocks it.
export function primeSpeech() {
  if (speechReady) return;
  speechReady = true;
  try {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch {}
}

export function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    u.pitch = 1.2;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}

let actx = null;

export function beep(freq) {
  try {
    actx ??= new AudioContext();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.frequency.value = freq;
    o.type = "sine";
    g.gain.value = 0.08;
    o.connect(g).connect(actx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.25);
    o.stop(actx.currentTime + 0.26);
  } catch {}
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const DAYS_KEPT = 30;
const totalKey = (slug) => `kidgames:${slug}:total`;
const daysKey = (slug) => `kidgames:${slug}:days`;

export function recordPlay(slug) {
  try {
    const total = (parseInt(localStorage.getItem(totalKey(slug)) || "0") || 0) + 1;
    localStorage.setItem(totalKey(slug), String(total));
    const days = JSON.parse(localStorage.getItem(daysKey(slug)) || "{}");
    const today = todayKey();
    days[today] = (days[today] || 0) + 1;
    const trimmed = {};
    Object.keys(days).sort().slice(-DAYS_KEPT).forEach((k) => { trimmed[k] = days[k]; });
    localStorage.setItem(daysKey(slug), JSON.stringify(trimmed));
  } catch {}
}

export function getStats(slug) {
  try {
    const total = parseInt(localStorage.getItem(totalKey(slug)) || "0") || 0;
    const days = JSON.parse(localStorage.getItem(daysKey(slug)) || "{}");
    return { total, today: days[todayKey()] || 0, days };
  } catch {
    return { total: 0, today: 0, days: {} };
  }
}

// Wires the start / new-round / play-again / more-games controls every game shares.
export function wireControls(startGame) {
  const start = () => { primeSpeech(); startGame(); };
  document.getElementById("startBtn").addEventListener("click", () => {
    document.getElementById("startOverlay").classList.add("hidden");
    start();
  });
  document.getElementById("reset").addEventListener("click", start);
  document.getElementById("overlayAgain").addEventListener("click", start);
  document.getElementById("overlayMore").addEventListener("click", () => { location.href = "/kid-games/"; });
}
