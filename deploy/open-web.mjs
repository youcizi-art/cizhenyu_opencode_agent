#!/usr/bin/env node
/**
 * CIZHENYU OpenCode — 本机 serve + /api/pair，stdout 打印 JSON 配对 URL。
 * Deploy 只调本脚本并开 WebView；勿在 Deploy 内复制此逻辑。
 *
 * env: XDG_CONFIG_HOME, OPENCODE_PASSWORD?, CIZHENYU_OPENCODE_PORT?, CIZHENYU_WORKSPACE?
 */
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTALL = join(__dirname, "..");
const HOME = join(INSTALL, "home");
const PID_FILE = join(HOME, ".cizhenyu-opencode.pid");
const PORT_FILE = join(HOME, ".cizhenyu-opencode-port");
const PASS_FILE = join(HOME, ".cizhenyu-opencode-password");
const LOG_OUT = join(HOME, ".cizhenyu-opencode-serve.out.log");
const LOG_ERR = join(HOME, ".cizhenyu-opencode-serve.err.log");
const DEFAULT_PORT = 13990;

function fail(message) {
  process.stdout.write(JSON.stringify({ ok: false, message }) + "\n");
  process.exit(1);
}

function ok(payload) {
  process.stdout.write(JSON.stringify({ ok: true, ...payload }) + "\n");
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function findCli() {
  const win = join(INSTALL, "node_modules", "@opencode", "cli", "bin", "opencode.exe");
  if (existsSync(win)) return win;
  const cmd = join(INSTALL, "node_modules", ".bin", "opencode.cmd");
  if (existsSync(cmd)) return cmd;
  const unix = join(INSTALL, "node_modules", ".bin", "opencode");
  if (existsSync(unix)) return unix;
  return null;
}

function ensurePassword() {
  ensureDir(HOME);
  if (process.env.OPENCODE_PASSWORD?.trim()) return process.env.OPENCODE_PASSWORD.trim();
  if (existsSync(PASS_FILE)) {
    const p = readFileSync(PASS_FILE, "utf8").trim();
    if (p) return p;
  }
  const generated = `cz-oc-${Date.now().toString(16)}`;
  writeFileSync(PASS_FILE, generated, "utf8");
  return generated;
}

function readPreferredPort() {
  if (process.env.CIZHENYU_OPENCODE_PORT) {
    const n = Number(process.env.CIZHENYU_OPENCODE_PORT);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (existsSync(PORT_FILE)) {
    const n = Number(readFileSync(PORT_FILE, "utf8").trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_PORT;
}

function portOpen(port) {
  return new Promise((resolve) => {
    const s = createConnection({ host: "127.0.0.1", port }, () => {
      s.end();
      resolve(true);
    });
    s.on("error", () => resolve(false));
    s.setTimeout(250, () => {
      s.destroy();
      resolve(false);
    });
  });
}

async function apiInfoOk(port, password) {
  try {
    const auth = Buffer.from(`opencode:${password}`).toString("base64");
    const res = await fetch(`http://127.0.0.1:${port}/api/info`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function processAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function pickPort(preferred) {
  for (let i = 0; i < 10; i++) {
    const port = preferred + i;
    if (!(await portOpen(port))) return port;
    if (await apiInfoOk(port, ensurePassword())) return port;
  }
  throw new Error(`OpenCode 端口 ${preferred}–${preferred + 9} 均被占用`);
}

async function waitReady(port, password, tries = 80) {
  for (let i = 0; i < tries; i++) {
    if (await apiInfoOk(port, password)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function startServe(exe, port, password, workspace, xdg) {
  ensureDir(HOME);
  const outFd = openSync(LOG_OUT, "w");
  const errFd = openSync(LOG_ERR, "w");
  const child = spawn(
    exe,
    ["serve", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: workspace,
      env: { ...process.env, XDG_CONFIG_HOME: xdg, OPENCODE_PASSWORD: password },
      detached: true,
      stdio: ["ignore", outFd, errFd],
      windowsHide: true,
    },
  );
  child.unref();
  writeFileSync(PID_FILE, String(child.pid), "utf8");
  writeFileSync(PORT_FILE, String(port), "utf8");
  return child.pid;
}

async function createPairUrl(port, password) {
  const auth = Buffer.from(`opencode:${password}`).toString("base64");
  const res = await fetch(`http://127.0.0.1:${port}/api/pair`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`/api/pair failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data?.code) throw new Error("/api/pair missing code");
  return `http://127.0.0.1:${port}/auth/connect/${data.code}`;
}

async function main() {
  const xdg = process.env.XDG_CONFIG_HOME?.trim() || join(HOME, "config");
  ensureDir(join(xdg, "opencode"));
  process.env.XDG_CONFIG_HOME = xdg;

  const exe = findCli();
  if (!exe) fail("未找到 opencode CLI，请先在 Deploy 安装 OpenCode Agent");

  const password = ensurePassword();
  process.env.OPENCODE_PASSWORD = password;
  const workspace = process.env.CIZHENYU_WORKSPACE?.trim() || process.cwd();

  let port = readPreferredPort();
  const pidRaw = existsSync(PID_FILE) ? Number(readFileSync(PID_FILE, "utf8").trim()) : 0;

  if (!(await apiInfoOk(port, password))) {
    if (pidRaw && processAlive(pidRaw)) {
      try {
        process.kill(pidRaw);
      } catch {
        /* ignore */
      }
      try {
        unlinkSync(PID_FILE);
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    port = await pickPort(port);
    if (await apiInfoOk(port, password)) {
      writeFileSync(PORT_FILE, String(port), "utf8");
    } else if (await portOpen(port)) {
      fail(`端口 ${port} 已被占用且不是本机 OpenCode 隔离服务`);
    } else {
      const pid = startServe(exe, port, password, workspace, xdg);
      if (!(await waitReady(port, password))) {
        fail(`opencode serve 未就绪（pid ${pid}），见 ${LOG_ERR}`);
      }
    }
  }

  const connectUrl = await createPairUrl(port, password);
  ok({
    connectUrl,
    webUrl: `http://127.0.0.1:${port}/`,
    port,
    exePath: exe,
    homeDir: xdg,
  });
}

main().catch((e) => fail(String(e?.message || e)));
