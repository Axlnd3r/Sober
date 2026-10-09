import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const pages = await fetch("http://127.0.0.1:9334/json").then(r => r.json());
const page = pages.find(p => p.type === "page");
if (!page) throw new Error("A temporary Chrome CDP session is required on port 9334");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let sequence = 0;
const pending = new Map();
const errors = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  const waiter = pending.get(message.id);
  if (waiter) { pending.delete(message.id); clearTimeout(waiter.timer); message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result); }
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 20000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(expression) {
  const end = Date.now() + 25000;
  while (Date.now() < end) { if (await evaluate(expression)) return; await pause(200); }
  throw new Error(`Condition timed out: ${expression}`);
}
async function screenshot(name) {
  const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(`docs/previews/${name}.png`, Buffer.from(image.data, "base64"));
}
async function click(selector) {
  const box = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 }; })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...box });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...box });
}
try {
  mkdirSync("docs/previews", { recursive: true });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await until("document.querySelector('.cinema-editorial h1') && document.querySelector('.cinema-photo-slide img').complete");
  await evaluate("document.fonts.ready"); await pause(1200);
  assert.equal(await evaluate("document.fonts.check('800 16px \"Plus Jakarta Sans\"')"), true);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  await screenshot("sober-cinema-desktop");
  await until("Array.from(document.querySelectorAll('.cinema-ring-art .cinema-team-badge img')).length === 2 && Array.from(document.querySelectorAll('.cinema-ring-art .cinema-team-badge img')).every(img => img.complete && img.naturalWidth > 0)");
  assert.equal(await evaluate("document.querySelector('.cinema-ring-art .cinema-team-badge').getBoundingClientRect().width >= 64"), true, "overview badges are visibly large");
  await click('[aria-label="Show Manchester United vs Tottenham Hotspur"]');
  await until("document.querySelector('.cinema-editorial h1').innerText.includes('Manchester United')");
  assert.match(await evaluate("document.querySelector('.cinema-countdown-kind').innerText"), /MARKET CLOSES/);
  assert.match(await evaluate("document.querySelector('.cinema-match-rings').innerText"), /Tottenham Hotspur/);
  await pause(1100); await screenshot("sober-cinema-dynamic-match");
  await click('[aria-label="Show Arsenal vs Leeds United"]');
  await pause(800);
  const clockBefore = await evaluate("document.querySelector('.cinema-clock').innerText");
  await pause(1100);
  const clockAfter = await evaluate("document.querySelector('.cinema-clock').innerText");
  assert.notEqual(clockBefore, clockAfter, "countdown must tick");
  await click('[aria-label="Next slide"]');
  await until("document.querySelector('.cinema-editorial h1').innerText.includes('Good form')");
  await pause(1000); await screenshot("sober-cinema-slide-2");
  await click('[aria-label="Next slide"]');
  await until("document.querySelector('.cinema-editorial h1').innerText.includes('market see')");
  await pause(1000); await screenshot("sober-cinema-slide-3");
  await click('[aria-label="Slide 1: The fixture"]'); await pause(1000);
  await click('.cinema-odds-chip');
  await until("document.querySelector('.cinema-drawer').open && document.querySelectorAll('.cinema-market-row').length > 0");
  await pause(600); await screenshot("sober-cinema-markets");
  assert.equal(await evaluate("document.querySelector('.cinema-drawer').contains(document.activeElement)"), true, "dialog focuses inside");
  await click('.cinema-market-search input');
  await send("Input.insertText", { text: "Arsenal" });
  await until("document.querySelectorAll('.cinema-market-row').length === 1");
  await click('#cinema-tab-analyst');
  assert.match(await evaluate("document.querySelector('.cinema-drawer-content').innerText"), /Brief not published|Match Analyst/);
  await click('#cinema-tab-fixture');
  assert.match(await evaluate("document.querySelector('.cinema-drawer-content').innerText"), /Kickoff|schedule/);
  await click('#cinema-tab-story');
  assert.match(await evaluate("document.querySelector('.cinema-story h2').innerText"), /watch before kickoff/);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await until("!document.querySelector('.cinema-drawer').open");
  assert.equal(await evaluate("document.activeElement.classList.contains('cinema-odds-chip')"), true, "dialog returns focus");
  for (const width of [1024, 768, 390, 320]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width > 767 ? 900 : 844, deviceScaleFactor: 1, mobile: width < 768 });
    await pause(400);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `No overflow at ${width}`);
    await screenshot(`sober-cinema-${width}`);
    if (width === 390) {
      await click('.cinema-menu-toggle');
      assert.equal(await evaluate("document.querySelector('.cinema-menu-toggle').getAttribute('aria-expanded')"), "true");
      await click('.cinema-main-nav button');
      await until("document.querySelector('.cinema-drawer').open");
      await screenshot("sober-cinema-mobile-markets");
      assert.equal(await evaluate("document.querySelector('.cinema-drawer').getBoundingClientRect().width <= innerWidth"), true);
      await click('[aria-label="Close details"]');
    }
  }
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await click('[aria-label="Next slide"]'); await pause(300);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.cinema-transition-slices')).display"), "none");
  await send("Emulation.setEmulatedMedia", { features: [] });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ carousel: "3 slides passed", countdown: "ticks", drawer: "all tabs passed", marketSearch: "passed", keyboardFocus: "restored", widths: [1440, 1024, 768, 390, 320], reducedMotion: "passed", uncaughtExceptions: errors }, null, 2));
} finally { ws.close(); }
