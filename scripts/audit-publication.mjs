import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

const root = new URL('../', import.meta.url);
const candidates = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root, encoding: 'utf8',
}).split('\0').filter(Boolean);

const skippedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.ico', '.ttf', '.woff', '.woff2', '.mp4']);
const signatures = [
  ['private-key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['cloud access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{20,}\b/],
  ['API token', /\b(?:sk-[A-Za-z0-9_-]{20,}|panta_[A-Za-z0-9_-]{24,})\b/],
  ['credential assignment', /\b(?:PANTA_API_KEY|FOOTBALL_API_KEY|GROQ_API_KEY|JOB_SECRET|DATABASE_URL|SOLANA_PRIVATE_KEY|MNEMONIC|SEED_PHRASE)\s*[:=]\s*["']?(?!["'\s;#]|\$\{|process\.env\.|<)[^\s"';#]{8,}/i],
];

let findings = 0;
for (const file of candidates) {
  if (skippedExtensions.has(extname(file).toLowerCase())) continue;
  const path = new URL(file.replaceAll('\\', '/'), root);
  if (statSync(path).size > 1024 * 1024) continue;
  const content = readFileSync(path, 'utf8');
  content.split(/\r?\n/).forEach((line, index) => {
    for (const [label, pattern] of signatures) {
      if (pattern.test(line)) {
        if (label === 'credential assignment' && (
          file === 'scripts/audit-publication.mjs' ||
          (file === 'README.md' && /test-only|local mock/.test(line)) ||
          (file.startsWith('scripts/test-') || file === 'scripts/start-test-server.mjs') ||
          (file === 'scripts/setup-local.mjs' && /\.replace\(/.test(line)) ||
          (file === 'scripts/setup-panta.mjs' && /const updated = \/\^PANTA_API_KEY=/.test(line))
        )) continue;
        const context = [
          /localhost|127\.0\.0\.1/i.test(line) && 'localhost',
          /example|sample|your_|<[^>]+>|\.\.\./i.test(line) && 'placeholder',
          /process\.env|\$\{|getenv/i.test(line) && 'environment reference',
        ].filter(Boolean).join(', ') || 'review required';
        const value = line.match(/\b(?:PANTA_API_KEY|FOOTBALL_API_KEY|GROQ_API_KEY|JOB_SECRET|DATABASE_URL|SOLANA_PRIVATE_KEY|MNEMONIC|SEED_PHRASE)\s*[:=]\s*["']?([^\s"';#]+)/i)?.[1] || '';
        const shape = value.startsWith('postgres') ? 'database URL'
          : value.startsWith('http') ? 'HTTP URL'
          : value.startsWith('$') ? 'shell variable'
          : value.startsWith('process.env') ? 'environment variable'
          : /^[A-Z_]+$/.test(value) ? 'uppercase token'
          : /^[a-z_]+$/.test(value) ? 'lowercase token'
          : 'other';
        console.error(`${file}:${index + 1}: ${label} (${context}; ${shape}; ${value.length} chars)`);
        findings++;
      }
    }
  });
}

console.log(`Checked ${candidates.length} publishable files; ${findings} potential secret(s).`);
if (findings) process.exitCode = 1;
