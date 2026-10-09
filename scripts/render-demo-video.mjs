import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';

const root = resolve(import.meta.dirname, '..');
const outputDir = join(root, 'docs', 'demo-video');
const outputFile = join(outputDir, 'sober-panta-demo-v1.mp4');
const posterFile = join(outputDir, 'poster.png');
mkdirSync(outputDir, { recursive: true });

const chromeCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const chromePath = chromeCandidates.find(existsSync);
if (!chromePath) throw new Error('Chrome or Edge is required to render the video.');

const images = {
  hero: 'docs/previews/sober-cinema-desktop.png',
  market: 'docs/previews/sober-cinema-markets.png',
  room: 'docs/previews/sober-cinema-slide-2.png',
  notebook: 'docs/previews/notebook-mobile.png',
};

const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#08090d"><canvas id="film" width="1280" height="720"></canvas><script>
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d', { alpha: false });
const W = 1280, H = 720, duration = 43, fps = 30;
const src = ${JSON.stringify(images)};
const assets = {};
const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = '/asset/' + url;
});
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function text(str, x, y, size, color = '#f8f8fb', weight = 700, align = 'left') {
  ctx.font = weight + ' ' + size + 'px Arial, sans-serif'; ctx.textAlign = align;
  ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.textAlign = 'left';
}
function letterbox(img, x, y, w, h, zoom = 1, shiftX = 0) {
  const sw = img.width / zoom, sh = img.height / zoom;
  const sx = (img.width - sw) / 2 + shiftX * (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h); ctx.restore();
}
function base(t, section) {
  rect(0,0,W,H,'#08090d');
  rect(50,45,40,4,'#ff4054');
  text('sober.', 50, 93, 34, '#fff', 900);
  text('PANTA HACKATHON  /  PRODUCT DEMO', 1228, 77, 13, '#a8a8b3', 600, 'right');
  rect(50,675,1180,1,'#34343c');
  rect(50,675,1180 * clamp(t/duration),2,'#ff4054');
  text(section,50,706,12,'#c8c7cf',700);
  text(String(Math.ceil(t)).padStart(2,'0') + ' / 43', 1228,706,12,'#898892',600,'right');
}
function panelLabel(n, line1, line2) {
  text(n, 62, 174, 15, '#ff4b5d', 800);
  text(line1, 62, 208, 26, '#fff', 800);
  if (line2) text(line2, 62, 240, 26, '#fff', 800);
}
function draw(t) {
  const i = Math.floor(t);
  if (t < 5) {
    base(t,'THE IDEA');
    const a = ease((t-.3)/1.1);
    ctx.globalAlpha = a;
    text('Before kickoff,',75,302,82,'#fff',900);
    text('make the call.',75,398,82,'#fff',900);
    rect(78,435,405*ease((t-1.3)/1.1),5,'#ff4054');
    text('Keep the reason. Revisit the evidence.',79,492,28,'#b9b8c0',500);
    ctx.globalAlpha = 1;
  } else if (t < 13) {
    base(t,'01  /  MATCH DISCOVERY');
    panelLabel('01','Football first.','Market context beside it.');
    const zoom = 1 + .035 * ease((t-5)/8);
    letterbox(assets.hero, 525,135,704,484,zoom,-.4);
    rect(525,135,704,484,'rgba(0,0,0,.05)');
    text('Fixture, question and cutoff in one view',62,585,18,'#c1c0c9',500);
    text('Captured product screen · October 2026',62,611,13,'#8c8b95',500);
  } else if (t < 21) {
    base(t,'02  /  PANTA MARKETS');
    panelLabel('02','The question comes','from Panta.');
    letterbox(assets.market, 525,135,704,484,1+.045*ease((t-13)/8),-.3);
    text('Market phase and available prices stay visible',62,585,18,'#c1c0c9',500);
    text('Prices shown are a captured snapshot',62,611,13,'#8c8b95',500);
  } else if (t < 29) {
    base(t,'03  /  YOUR PERSPECTIVE');
    panelLabel('03','Choose a side.','Know the context.');
    letterbox(assets.room, 525,135,704,484,1+.04*ease((t-21)/8),.25);
    text('A football decision, grounded in the market',62,585,18,'#c1c0c9',500);
    text('Captured product screen · October 2026',62,611,13,'#8c8b95',500);
  } else if (t < 37) {
    base(t,'04  /  MY NOTEBOOK');
    panelLabel('04','Your call.','Your record.');
    const img=assets.notebook;
    const h=525, w=h*img.width/img.height;
    rect(741,121,350,531,'#1a1a21');
    ctx.drawImage(img,810,124,w,h);
    text('Save a forecast and the reason behind it',62,585,18,'#c1c0c9',500);
    text('Practice example · saved on this device',62,611,13,'#8c8b95',500);
  } else {
    base(t,'SOBER × PANTA');
    const a=ease((t-37)/1.2); ctx.globalAlpha=a;
    text('Make your call.',75,295,78,'#fff',900);
    text('Own your reasoning.',75,385,78,'#fff',900);
    rect(78,423,535,5,'#ff4054');
    text('sober.  ×  Panta',78,496,29,'#c8c7cf',600);
    text('Football, in focus.',78,539,18,'#9d9ca7',500);
    ctx.globalAlpha=1;
  }
  if (t > 5 && t < 37) {
    const boundary = t < 13 ? 5 : t < 21 ? 13 : t < 29 ? 21 : 29;
    const fade = Math.max(1-ease((t-boundary)/.45),ease((t-(boundary+8-.45))/.45));
    rect(0,0,W,H,'rgba(8,9,13,'+(fade*.8)+')');
  }
}
async function run() {
  for (const [name,url] of Object.entries(src)) assets[name] = await loadImage(url);
  draw(9);
  const poster = canvas.toDataURL('image/png');
  await fetch('/poster',{method:'POST',body:await (await fetch(poster)).blob()});
  draw(0);
  const stream = canvas.captureStream(fps);
  const type = ['video/mp4;codecs=avc1.42E01E','video/mp4'].find(MediaRecorder.isTypeSupported);
  if (!type) throw new Error('No supported MP4 encoder');
  const recorder = new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:4200000});
  const chunks = [];
  recorder.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
  const done = new Promise((resolve,reject)=>{ recorder.onstop=resolve; recorder.onerror=reject; });
  recorder.start(1000);
  const start = performance.now();
  const timer = setInterval(() => {
    const t = Math.min((performance.now()-start)/1000,duration);
    draw(t);
    if (t>=duration) { clearInterval(timer); recorder.stop(); }
  },1000/fps);
  await done;
  const blob = new Blob(chunks,{type});
  const response=await fetch('/upload',{method:'POST',headers:{'Content-Type':type},body:blob});
  if(!response.ok) throw new Error('Video upload failed: '+response.status);
  document.title='DONE: '+(blob.size/1048576).toFixed(1)+' MB';
}
run().catch(error=>{document.title='ERROR: '+error.message; fetch('/error',{method:'POST',body:error.stack||String(error)});});
</script></body></html>`;

let resolveDone;
let rejectDone;
const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
const server = createServer((req, res) => {
  if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return; }
  if (req.url === '/video') {
    import('node:fs').then(({createReadStream,statSync}) => {
      const size=statSync(outputFile).size;
      const match=/bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
      const start=match ? Number(match[1]) : 0;
      const end=match && match[2] ? Math.min(Number(match[2]),size-1) : size-1;
      res.writeHead(match ? 206 : 200, {
        'Content-Type':'video/mp4','Accept-Ranges':'bytes',
        'Content-Length':end-start+1,
        ...(match ? {'Content-Range':`bytes ${start}-${end}/${size}`} : {}),
      });
      createReadStream(outputFile,{start,end}).pipe(res);
    });
    return;
  }
  if (req.url?.startsWith('/asset/')) {
    const asset = decodeURIComponent(req.url.slice(7));
    if (!Object.values(images).includes(asset)) { res.writeHead(404); res.end(); return; }
    import('node:fs').then(({createReadStream}) => {
      res.writeHead(200, {'Content-Type':'image/png'}); createReadStream(join(root, asset)).pipe(res);
    });
    return;
  }
  if (req.url === '/poster' || req.url === '/upload') {
    const path = req.url === '/poster' ? posterFile : outputFile;
    const out = createWriteStream(path);
    req.pipe(out);
    out.on('finish', () => { res.writeHead(200); res.end('ok'); if(req.url === '/upload') resolveDone(path); });
    out.on('error', rejectDone);
    return;
  }
  if (req.url === '/error') {
    let msg=''; req.on('data',chunk=>msg+=chunk); req.on('end',()=>{res.writeHead(200);res.end(); rejectDone(new Error(msg));}); return;
  }
  res.writeHead(404); res.end();
});

const serveOnly = process.argv.includes('--serve');
const inspectOnly = process.argv.includes('--inspect');
server.listen(serveOnly || inspectOnly ? 4319 : 0,'127.0.0.1',async()=>{
  const address=server.address();
  if (inspectOnly) { console.log(`Inspect http://127.0.0.1:${address.port}/video`); return; }
  console.log(`Rendering silent 43-second video to ${outputFile}`);
  if (serveOnly) {
    console.log(`Open http://127.0.0.1:${address.port}/ in a Chromium browser to render.`);
    try { console.log(await done); } catch(error) { console.error(error); process.exitCode=1; }
    finally { server.close(); }
    return;
  }
  const profile=mkdtempSync(join(tmpdir(),'sober-video-chrome-'));
  const browser = spawn(chromePath,[
    '--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-gpu',
    `--user-data-dir=${profile}`,
    '--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling',
    '--disable-renderer-backgrounding','--window-size=1280,720',
    `http://127.0.0.1:${address.port}/`
  ],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  browser.stderr.on('data', chunk => console.error(String(chunk).slice(0,500)));
  browser.on('error', rejectDone);
  browser.on('exit', code => { if(code !== null && code !== 0) rejectDone(new Error(`Browser exited with code ${code}`)); });
  const timeout=setTimeout(()=>rejectDone(new Error('Rendering timed out after 90 seconds')),90000);
  try { console.log(await done); }
  catch(error) { console.error(error); process.exitCode=1; }
  finally {
    clearTimeout(timeout); browser.kill(); server.close();
    if (resolve(profile).startsWith(resolve(tmpdir(),'sober-video-chrome-')))
      try { rmSync(profile,{recursive:true,force:true}); } catch {}
  }
});
