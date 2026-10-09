import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

await mkdir("public/images/cinema", { recursive: true });
await mkdir("public/fonts", { recursive: true });
const original = "C:/Users/User/.codex/generated_images/01a11969-032d-7772-af5e-5a2bc5466172/exec-20ed806e-bb9e-4d5d-8321-20ee399e186a.png";
await sharp(original).webp({ quality: 90 }).toFile("public/images/cinema/matchday.webp");
await sharp("C:/Users/User/.codex/generated_images/01a11969-032d-7772-af5e-5a2bc5466172/exec-072e42f5-ab89-445e-8f0f-6c457b072e5e.png").webp({ quality: 90 }).toFile("public/images/cinema/form.webp");
await sharp("C:/Users/User/.codex/generated_images/01a11969-032d-7772-af5e-5a2bc5466172/exec-b5382d91-067a-4e09-a126-4b671b74b261.png").webp({ quality: 90 }).toFile("public/images/cinema/market.webp");
const font = await fetch("https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf");
if (!font.ok) throw new Error(`Font request failed ${font.status}`);
await writeFile("public/fonts/plus-jakarta-sans-variable.ttf", Buffer.from(await font.arrayBuffer()));
const license = await fetch("https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/OFL.txt");
if (license.ok) await writeFile("public/fonts/OFL-PlusJakartaSans.txt", await license.text());
try {
  const video = await fetch("https://cdn.dribbble.com/userupload/42782795/file/original-583093d9b56f2ed9c78792764e9ca19c.mp4");
  if (!video.ok) throw new Error(`HTTP ${video.status}`);
  await writeFile("C:/Users/User/AppData/Local/Temp/sober-reference.mp4", Buffer.from(await video.arrayBuffer()));
  console.log("Reference video downloaded to temporary folder");
} catch (error) { console.log(`Reference video: ${error.message}`); }
console.log("Hero WebP and self-hosted font prepared");
