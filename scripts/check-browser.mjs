import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
const pages = await fetch("http://127.0.0.1:9334/json").then(r => r.json());
const page = pages.find(p => p.type === "page");
if (!page) throw new Error("Start the temporary headless Chrome session on port 9334 first");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let sequence = 0;
const pending = new Map();
const exceptions = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
  const waiter = pending.get(message.id);
  if (waiter) { pending.delete(message.id); clearTimeout(waiter.timer); message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result); }
};
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 15000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
async function until(expression) { const end = Date.now() + 20000; while (Date.now() < end) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 250)); } throw new Error(`Condition timed out: ${expression}`); }
try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://localhost:3000/markets" });
  await until("document.body.innerText.includes('Panta API connected') && document.querySelectorAll('.catalog-row').length > 0");
  const marketCount = await evaluate("document.querySelectorAll('.catalog-row').length");
  assert.ok(marketCount > 0);
  mkdirSync("docs/previews", { recursive: true });
  let screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync("docs/previews/panta-markets-desktop.png", Buffer.from(screenshot.data, "base64"));
  await evaluate("document.querySelector('.catalog-filters input').focus()");
  await send("Input.insertText", { text: "Arsenal" });
  await until("document.querySelectorAll('.catalog-row').length === 1");
  assert.match(await evaluate("document.querySelector('.catalog-row').innerText"), /Arsenal/);
  await evaluate("document.querySelector('.catalog-row summary').click()");
  assert.equal(await evaluate("document.querySelector('.catalog-row details').open"), true);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await until("document.querySelector('.app-sidebar').getBoundingClientRect().right <= 0");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "catalog must not overflow mobile viewport");
  screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync("docs/previews/panta-markets-mobile.png", Buffer.from(screenshot.data, "base64"));
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await until("document.body.innerText.includes('Panta connected')");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "home must not overflow mobile viewport");
  const results = { marketsLoaded: marketCount, search: "passed", details: "passed", mobileOverflow: "none", homeConnection: "connected", uncaughtExceptions: exceptions };
  assert.equal(exceptions.length, 0);
  console.log(JSON.stringify(results, null, 2));
} finally { ws.close(); }
