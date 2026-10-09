import { createServer } from "node:http";
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const outputDir = join(root, "docs", "demo-video");
mkdirSync(outputDir, { recursive: true });
const outputFile = join(outputDir, "sober-panta-demo-v2.mp4");
const posterFile = join(outputDir, "poster-v2.png");
const chromePath = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].find(existsSync);
if (!chromePath) throw new Error("Chrome or Edge is required to render the video");

const images = {
  overview: "docs/previews/sober-cinema-desktop.png",
  market: "docs/previews/sober-cinema-markets.png",
  match: "docs/previews/sober-cinema-slide-2.png",
  notebook: "docs/previews/notebook-mobile.png",
};

const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#090b0d"><canvas id="film" width="1280" height="720"></canvas><script>
const canvas=document.getElementById('film'),c=canvas.getContext('2d',{alpha:false});
const W=1280,H=720,D=126,FPS=30,src=${JSON.stringify(images)},assets={};
const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n)};
function box(x,y,w,h,fill,r=0){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()}
function line(x1,y1,x2,y2,stroke,width=1){c.strokeStyle=stroke;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()}
function txt(s,x,y,size=24,color='#f4f2ee',weight=500,align='left'){c.font=weight+' '+size+'px Arial,sans-serif';c.textAlign=align;c.fillStyle=color;c.fillText(s,x,y);c.textAlign='left'}
function image(img,x,y,w,h,zoom=1,pan=0){const ratio=Math.max(w/img.width,h/img.height)*zoom,sw=w/ratio,sh=h/ratio,sx=(img.width-sw)/2+pan*(img.width-sw)/2,sy=(img.height-sh)/2;c.save();c.beginPath();c.roundRect(x,y,w,h,13);c.clip();c.drawImage(img,sx,sy,sw,sh,x,y,w,h);c.restore()}
function fade(t,start,end){return Math.min(ease((t-start)/.7),1-ease((t-(end-.7))/.7))}
function shell(t,kicker){box(0,0,W,H,'#0a0c0e');box(0,0,W,5,'#d44046');txt('sober.',54,88,32,'#fff',800);txt('PANTA HACKATHON  /  2026',1226,78,14,'#b2b4b6',700,'right');line(54,658,1226,658,'#343a3b');box(54,658,1172*clamp(t/D),3,'#d44046');txt(kicker.toUpperCase(),54,694,13,'#aeb5b1',700);txt('SILENT PRODUCT FILM',1226,694,13,'#7e8583',700,'right')}
function tag(s,x,y,color='#d44046'){txt(s.toUpperCase(),x,y,16,color,800)}
function card(x,y,w,h){box(x+7,y+8,w,h,'rgba(0,0,0,.35)',15);box(x,y,w,h,'#171c1d',15);c.strokeStyle='#3b4442';c.lineWidth=1;c.strokeRect(x,y,w,h)}
function ball(x,y,r,a=0){
 c.save();c.translate(x,y);c.rotate(a);
 const glow=c.createRadialGradient(0,0,r*.2,0,0,r*2);glow.addColorStop(0,'rgba(222,237,224,.22)');glow.addColorStop(1,'rgba(222,237,224,0)');box(-r*2,-r*2,r*4,r*4,glow);
 const grad=c.createRadialGradient(-r*.28,-r*.35,2,0,0,r);grad.addColorStop(0,'#fff');grad.addColorStop(.65,'#e9e9de');grad.addColorStop(1,'#85918b');c.fillStyle=grad;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();c.strokeStyle='#3d4a47';c.lineWidth=Math.max(1,r*.022);c.stroke();
 const pent=(px,py,rad,rot)=>{c.beginPath();for(let i=0;i<5;i++){const z=rot+i*Math.PI*2/5;i?c.lineTo(px+Math.cos(z)*rad,py+Math.sin(z)*rad):c.moveTo(px+Math.cos(z)*rad,py+Math.sin(z)*rad)}c.closePath();c.fillStyle='#232b2b';c.fill()};
 pent(0,0,r*.37,-Math.PI/2);for(let i=0;i<5;i++){const z=-Math.PI/2+i*Math.PI*2/5;const px=Math.cos(z)*r*.77,py=Math.sin(z)*r*.77;pent(px,py,r*.22,z);line(Math.cos(z)*r*.37,Math.sin(z)*r*.37,px,py,'#5a6662',r*.017)}
 c.restore();
}
function football(t){
 box(0,0,W,H,'#070d0c');
 const g=c.createLinearGradient(0,320,0,H);g.addColorStop(0,'#14241c');g.addColorStop(1,'#122518');box(0,320,W,400,g);
 for(let i=0;i<7;i++){const y=390+i*i*8;line(0,y,W,y,'rgba(202,227,191,.11)',1)}
 line(0,366,W,366,'#3e6547',3);c.strokeStyle='rgba(205,230,211,.23)';c.lineWidth=4;c.beginPath();c.ellipse(630,489,275,110,0,0,Math.PI*2);c.stroke();
 for(let i=0;i<22;i++){const x=(i*79+11)%W,y=95+(i*53)%270;box(x,y,3,3,'rgba(230,242,230,.36)',3)}
 const q=ease(t/7.7),x=-105+q*690,y=380-120*Math.sin(q*Math.PI)+q*115,r=26+q*136;
 for(let i=0;i<8;i++){const z=clamp(q-i*.08);line(-30,410+i*11,x-r*.7-(i*13),y+i*9,'rgba(200,225,200,'+(.05+.055*z)+')',2+i*.8)}
 ball(x,y,r,t*2.5);
 if(t>5.6){const a=ease((t-5.6)/1.2);c.globalAlpha=a;box(58,40,498,134,'rgba(7,13,12,.8)',8);txt('sober.',80,105,48,'#fff',900);txt('THE REASON BEHIND THE CALL',82,142,19,'#c8d6cb',700);c.globalAlpha=1}
 box(52,670,1176*clamp(t/D),3,'#d44046');
}
function typeScene(t){shell(t,'The problem');tag('Before the whistle',64,170);txt('Predictions have an outcome.',64,261,54,'#f4f2ee',800);txt('But where did the reasoning go?',64,331,54,'#f4f2ee',800);box(64,372,670,4,'#d44046');txt('A price can tell you what a market thinks.',64,439,27,'#bec8c1');txt('It cannot remember why you believed it.',64,479,27,'#bec8c1');card(886,193,304,316);txt('YES',926,257,20,'#cdd5cc',800);line(926,275,1150,275,'#5d6b61',1);txt('?',1028,407,116,'#d44046',800,'center');txt('YOUR CONTEXT',934,466,16,'#909b93',700)}
function pictureScene(t,kicker,num,title1,title2,caption,secondary,key,start,end,pan=0){shell(t,kicker);tag(num,64,177);txt(title1,64,235,36,'#fff',800);txt(title2,64,280,36,'#fff',800);txt(caption,64,418,21,'#c5cec7');txt(secondary,64,452,21,'#c5cec7');image(assets[key],506,145,720,460,1+.04*ease((t-start)/(end-start)),pan);box(506,145,720,460,'rgba(0,0,0,.07)',13);txt('Captured product screen  /  October 2026',506,630,13,'#8c9690',600)}
function notebookScene(t){shell(t,'The record');tag('04 / Saved reasoning',64,176);txt('Keep the call.',64,244,43,'#fff',800);txt('Keep the context.',64,300,43,'#fff',800);txt('Forecast, reason, time and visible market',64,425,22,'#c6cfc8');txt('context become a revisitable record.',64,458,22,'#c6cfc8');box(753,123,322,524,'#222928',20);image(assets.notebook,771,136,286,500,1);txt('Practice record shown in capture',64,615,15,'#89928c',600)}
function step(x,y,n,title,sub){card(x,y,346,130);box(x+17,y+22,34,34,'#d44046',18);txt(n,x+34,y+47,17,'#fff',800,'center');txt(title,x+65,y+47,21,'#f7f7f1',800);txt(sub,x+20,y+91,16,'#b7c1b9',500)}
function flowScene(t,claim=false){shell(t,claim?'Claim walkthrough':'Buy walkthrough');tag(claim?'06 / Claim eligibility':'05 / Panta transaction path',64,165);txt(claim?'Claim only when eligible.':'A buy needs your approval.',64,234,44,'#fff',800);txt(claim?'A resolved winning position is required.':'Sober checks the room and live market first.',64,278,23,'#bfc9c1');if(!claim){step(64,356,'1','Panta quote','Price and amount are shown');step(467,356,'2','Wallet approval','User signs the built transaction');step(870,356,'3','Verified position','Chain and Panta state checked')}else{step(64,356,'1','Check holdings','Signed-in wallet positions');step(467,356,'2','Panta eligibility','Resolved market + winning side');step(870,356,'3','Wallet approval','Claim needs a new signature')}box(64,548,1148,65,'#2b2424',9);box(64,548,5,65,'#d44046');txt('FLOW WALKTHROUGH  /  No signed transaction or eligible claim was recorded in this capture.',86,588,18,'#f1d9d7',700)}
function lastScene(t){shell(t,'Why Sober');tag('Football, in focus',64,168);txt('Market signal.',64,258,61,'#fff',800);txt('Personal judgment.',64,333,61,'#fff',800);txt('A record of why.',64,408,61,'#d44046',800);line(66,440,720,440,'#45534c',2);txt('Sourced match context + Panta prices + a saved pre-match rationale.',66,502,23,'#bec9c0');txt('Free to forecast. Wallet approval for every transaction.',66,542,23,'#bec9c0');txt('sober.  /  Built for the Panta Hackathon',66,620,17,'#89948c',700)}
function draw(t){
 if(t<9)football(t);
 else if(t<22)typeScene(t);
 else if(t<37)pictureScene(t,'The product','01 / Sober','A matchday companion,','not another score feed.','Fixture, cutoff and market context','sit together before kickoff.','overview',22,37,-.2);
 else if(t<52)pictureScene(t,'Match evidence','02 / Decision context','Read the match.','Then make your call.','The brief, rules and source links','give the question a clear meaning.','match',37,52,.15);
 else if(t<67)pictureScene(t,'Panta markets','03 / Live discovery','See the question','the market is asking.','Market phase and quoted prices','come from Panta when available.','market',52,67,-.1);
 else if(t<82)notebookScene(t);
 else if(t<99)flowScene(t,false);
 else if(t<113)flowScene(t,true);
 else lastScene(t);
 if(t>=9&&t<113){const starts=[9,22,37,52,67,82,99],ends=[22,37,52,67,82,99,113];const index=starts.findIndex((s,i)=>t>=s&&t<ends[i]);c.globalAlpha=1-fade(t,starts[index],ends[index]);box(0,0,W,H,'#090b0d');c.globalAlpha=1}
}
async function run(){
 for(const [name,url] of Object.entries(src)){assets[name]=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src='/asset/'+url})}
 draw(6.8);await fetch('/poster',{method:'POST',body:await(await fetch(canvas.toDataURL('image/png'))).blob()});draw(0);
 const stream=canvas.captureStream(FPS),type=['video/mp4;codecs=avc1.42E01E','video/mp4'].find(MediaRecorder.isTypeSupported);if(!type)throw new Error('MP4 recording is unsupported');
 const chunks=[],recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:2900000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=reject});recorder.start(1000);
 const start=performance.now(),timer=setInterval(()=>{const t=Math.min((performance.now()-start)/1000,D);draw(t);if(t>=D){clearInterval(timer);recorder.stop()}},1000/FPS);
 await stopped;const blob=new Blob(chunks,{type});const response=await fetch('/upload',{method:'POST',headers:{'Content-Type':type},body:blob});if(!response.ok)throw new Error('Upload failed');document.title='DONE '+(blob.size/1048576).toFixed(1)+' MB';
}
run().catch(error=>{document.title='ERROR '+error.message;fetch('/error',{method:'POST',body:String(error.stack||error)})});
</script></body></html>`;

let resolveDone, rejectDone;
const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); return; }
  if (req.url?.startsWith("/asset/")) {
    const path = decodeURIComponent(req.url.slice(7));
    if (!Object.values(images).includes(path)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": "image/png" }); createReadStream(join(root, path)).pipe(res); return;
  }
  if (req.url === "/poster" || req.url === "/upload") {
    const file = req.url === "/poster" ? posterFile : outputFile;
    const out = createWriteStream(file); req.pipe(out);
    out.on("finish", () => { res.writeHead(200); res.end("ok"); if (req.url === "/upload") resolveDone(file); });
    out.on("error", rejectDone); return;
  }
  if (req.url === "/error") {
    let message = ""; req.on("data", chunk => message += chunk);
    req.on("end", () => { res.writeHead(200); res.end(); rejectDone(new Error(message)); }); return;
  }
  res.writeHead(404); res.end();
});

server.listen(0, "127.0.0.1", async () => {
  const address = server.address();
  console.log(`Rendering silent ${126}-second video to ${outputFile}`);
  const profile = mkdtempSync(join(tmpdir(), "sober-video-v2-"));
  const browser = spawn(chromePath, ["--headless=new", "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--disable-gpu", `--user-data-dir=${profile}`, "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--window-size=1280,720", `http://127.0.0.1:${address.port}/`], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  browser.stderr.on("data", chunk => { const message = String(chunk); if (/error|failed/i.test(message)) console.error(message.slice(0, 400)); });
  browser.on("error", rejectDone);
  browser.on("exit", code => { if (code !== null && code !== 0) rejectDone(new Error(`Browser exited with code ${code}`)); });
  const timeout = setTimeout(() => rejectDone(new Error("Rendering timed out")), 165000);
  try { console.log(await done); }
  catch (error) { console.error(error); process.exitCode = 1; }
  finally {
    clearTimeout(timeout); browser.kill(); server.close();
    if (resolve(profile).startsWith(resolve(tmpdir(), "sober-video-v2-"))) {
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
    }
  }
});
