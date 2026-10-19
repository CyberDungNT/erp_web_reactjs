#!/usr/bin/env node
/**
 * CẬP NHẬT LÊN SERVER BẰNG 1 LỆNH (không cần vào server chép file)
 *
 *   npm run deploy                 build giao diện web (vite) -> đẩy lên server
 *   npm run deploy -- api          dotnet publish API -> đẩy lên server -> chờ API khởi động lại
 *   npm run deploy -- all          cả 2
 *   thêm:  --note "sửa lỗi in phiếu"   ghi chú lượt cập nhật
 *          --skip-build                dùng sẵn dist / bản publish cũ (không build lại, KHÔNG tăng phiên bản)
 *          --no-bump                   build nhưng giữ nguyên số phiên bản
 *
 *   npm run release                build web -> tạo releases/erp-web-v1.0.n.zip để kéo vào màn "Cập nhật hệ thống" (không đẩy lên)
 *
 * TỰ TĂNG PHIÊN BẢN: mỗi lần build web để cập nhật (deploy / release), "version" trong package.json tăng 1.0.n -> 1.0.(n+1)
 * (ghi cả package-lock.json). Build / tải lên lỗi -> trả lại số cũ. Số này hiện ở màn cập nhật + version.json của bản web.
 *
 * Cấu hình: file .env.deploy (KHÔNG đưa vào git – xem .env.deploy.example) hoặc biến môi trường:
 *   DEPLOY_URL          địa chỉ API, vd https://apiweb.shopphanmem.io.vn  (bỏ trống -> lấy VITE_API_BASE_URL trong .env)
 *   DEPLOY_KEY          khoá cập nhật = Deploy:Key cấu hình trên server
 *   DEPLOY_API_PROJECT  đường dẫn file .csproj của API (mặc định ../API_App_Demo/API_App_Demo/API_App_Demo.csproj)
 *
 * Server: API_App_Demo/Controllers/DeployController.cs (cần Deploy:Key, Deploy:WebPath trên server)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args.splice(i, 2)[1] ?? '') : undefined; };
const note = flag('--note') || '';
const skipBuild = args.includes('--skip-build');
const noBump = args.includes('--no-bump');
const zipOnly = args.includes('--zip-only'); // npm run release: chỉ build + tạo file zip, không đẩy lên server
const target = (args.find((a) => !a.startsWith('--')) || 'web').toLowerCase();
if (!['web', 'api', 'all'].includes(target)) die(`Không hiểu "${target}" – dùng: web | api | all`);
let restoreVersion = null; // tăng phiên bản rồi mà lỗi -> trả lại số cũ (die gọi)

if (zipOnly) {
  const v = bumpVersion();
  run('Build giao diện web', process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], ROOT);
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) die('Không thấy dist/index.html – build lỗi?');
  const dir = path.join(ROOT, 'releases');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `erp-web-v${v}.zip`);
  fs.writeFileSync(file, zipFolder(dist));
  console.log(`\n✔ Phiên bản ${v} – kéo file này vào màn "Cập nhật hệ thống":\n  ${file}\n`);
  process.exit(0);
}

// ---------- cấu hình ----------
const readEnv = (file) => {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
};
const env = { ...readEnv(path.join(ROOT, '.env')), ...readEnv(path.join(ROOT, '.env.deploy')), ...process.env };
const URL_BASE = (env.DEPLOY_URL || env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const KEY = env.DEPLOY_KEY || '';
const API_PROJECT = path.resolve(ROOT, env.DEPLOY_API_PROJECT || '../API_App_Demo/API_App_Demo/API_App_Demo.csproj');
if (!URL_BASE) die('Chưa có địa chỉ API: đặt DEPLOY_URL trong .env.deploy (xem .env.deploy.example).');
if (!KEY) die('Chưa có khoá cập nhật: đặt DEPLOY_KEY trong .env.deploy (= Deploy:Key trên server).');

let by = os.userInfo().username;
try { const g = spawnSync('git', ['config', 'user.name'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim(); if (g) by = g; } catch { /* không có git */ }

// ---------- chạy ----------
const t0 = Date.now();
console.log(`\n▶ Cập nhật ${target === 'all' ? 'web + API' : target.toUpperCase()} lên ${URL_BASE}\n`);
await checkKey();
if (target === 'web' || target === 'all') await deployWeb();
if (target === 'api' || target === 'all') await deployApi();
console.log(`\n✔ Xong sau ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

async function deployWeb() {
  const dist = path.join(ROOT, 'dist');
  if (!skipBuild) {
    if (!noBump) bumpVersion();
    run('Build giao diện web', process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], ROOT);
  }
  if (!fs.existsSync(path.join(dist, 'index.html'))) die('Không thấy dist/index.html – build lỗi?');
  const zip = zipFolder(dist);
  const rec = await upload('web', zip);
  restoreVersion = null; // đã lên server -> giữ số mới
  console.log(`  ✔ Giao diện web v${readPkg().version}: ${rec.files} file thay đổi (${rec.added.length} mới, ${rec.replaced.length} sửa)${rec.files ? '' : ' – không có gì mới'}`);
}

async function deployApi() {
  if (!fs.existsSync(API_PROJECT)) die(`Không thấy project API: ${API_PROJECT} (đặt DEPLOY_API_PROJECT trong .env.deploy)`);
  const out = path.join(os.tmpdir(), 'erp-deploy-api');
  if (!skipBuild) {
    fs.rmSync(out, { recursive: true, force: true });
    run('Publish API', 'dotnet', ['publish', API_PROJECT, '-c', 'Release', '-o', out, '--nologo', '-v', 'q'], path.dirname(API_PROJECT));
  }
  if (!fs.existsSync(out)) die('Chưa có bản publish API (bỏ --skip-build).');
  const before = await info();
  const zip = zipFolder(out);
  const rec = await upload('api', zip);
  console.log(`  ✔ API: ${rec.files} file thay đổi (${rec.added.length} mới, ${rec.replaced.length} sửa, bỏ qua ${rec.skipped.length} file riêng của server)`);
  if (!rec.files) return;
  process.stdout.write('  … chờ API khởi động lại ');
  const end = Date.now() + 90000;
  await sleep(2500);
  while (Date.now() < end) {
    try { const now = await info(); if (now.api.startedAt !== before.api.startedAt) { console.log('✔'); return; } } catch { /* đang khởi động */ }
    process.stdout.write('.');
    await sleep(1500);
  }
  console.log('\n  ⚠ Chưa thấy API khởi động lại sau 90s – kiểm tra trên server.');
}

// ---------- gọi API ----------
async function checkKey() {
  try { await info(); } catch (e) { die(e.message); }
}

async function info() {
  const res = await fetch(`${URL_BASE}/api/Deploy/info`, { headers: { 'X-Deploy-Key': KEY } }).catch(() => null);
  if (!res) throw new Error(`Không kết nối được ${URL_BASE}`);
  if (res.status === 404) throw new Error('Server chưa có chức năng cập nhật (api/Deploy) – lần đầu phải chép bản API mới lên server bằng tay.');
  if (!res.ok) throw new Error(await errText(res));
  return res.json();
}

async function upload(kind, buf) {
  console.log(`  ↑ Tải gói ${kind} lên (${(buf.length / 1024 / 1024).toFixed(1)} MB)...`);
  const q = new URLSearchParams({ by, note });
  const res = await fetch(`${URL_BASE}/api/Deploy/${kind}?${q}`, {
    method: 'POST', headers: { 'X-Deploy-Key': KEY, 'Content-Type': 'application/zip' }, body: buf,
  }).catch((e) => die(`Mất kết nối khi tải lên: ${e.message}`));
  if (!res.ok) die(await errText(res));
  return res.json();
}

async function errText(res) {
  const b = await res.json().catch(() => null);
  return b?.detail || b?.title || `Lỗi ${res.status}`;
}

// ---------- tiện ích ----------
function run(title, cmd, cmdArgs, cwd) {
  console.log(`  • ${title}...`);
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit' });
  if (r.status !== 0) die(`${title} lỗi (mã ${r.status}).`);
}

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  if (restoreVersion) { restoreVersion(); console.error('  (đã trả lại số phiên bản cũ)\n'); }
  process.exit(1);
}

// ---------- phiên bản 1.0.n ----------
// (hàm – không dùng const ở đây: bumpVersion được gọi từ đầu file, const khai báo sau sẽ lỗi TDZ)
function readPkg() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')); }

/** Tăng số cuối của "version": 1.0.7 -> 1.0.8 (package.json + package-lock.json). Trả về số mới. */
function bumpVersion() {
  const PKG = path.join(ROOT, 'package.json');
  const LOCK = path.join(ROOT, 'package-lock.json');
  const pkgText = fs.readFileSync(PKG, 'utf8');
  const lockText = fs.existsSync(LOCK) ? fs.readFileSync(LOCK, 'utf8') : null;
  const old = readPkg().version || '1.0.0';
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(old) || [null, 1, 0, 0];
  const next = `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
  // chỉ thay đúng dòng "version" (giữ nguyên định dạng file)
  fs.writeFileSync(PKG, pkgText.replace(/("version"\s*:\s*")[^"]*(")/, `$1${next}$2`));
  if (lockText) {
    const lock = JSON.parse(lockText);
    lock.version = next;
    if (lock.packages?.['']) lock.packages[''].version = next;
    fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + (lockText.endsWith('\n') ? '\n' : ''));
  }
  restoreVersion = () => { fs.writeFileSync(PKG, pkgText); if (lockText) fs.writeFileSync(LOCK, lockText); };
  console.log(`  • Phiên bản ${old} → ${next}`);
  return next;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Nén cả thư mục thành 1 file zip (deflate) trong bộ nhớ – không cần thư viện ngoài */
function zipFolder(dir) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else files.push(p);
    }
  };
  walk(dir);
  const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc32 = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const parts = []; const central = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(path.relative(dir, f).split(path.sep).join('/'), 'utf8');
    const data = fs.readFileSync(f);
    const comp = zlib.deflateRawSync(data, { level: 6 });
    const store = comp.length >= data.length;
    const body = store ? data : comp;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); // utf8 name
    local.writeUInt16LE(store ? 0 : 8, 8); local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, name, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(store ? 0 : 8, 10); cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += 30 + name.length + body.length;
  }
  const cenSize = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cenSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}
