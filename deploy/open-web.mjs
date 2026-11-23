#!/usr/bin/env node
/**
 * CIZHENYU OpenCode — 本机 serve + /api/pair，stdout 打印 JSON 配对 URL。
 * Deploy 只调本脚本并开 WebView；勿在 Deploy 内复制此逻辑。
 *
 * env: XDG_CONFIG_HOME, XDG_CACHE_HOME?, OPENCODE_PASSWORD?, CIZHENYU_OPENCODE_PORT?, CIZHENYU_WORKSPACE?
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
import { basename, dirname, join, resolve } from "node:path";
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

function killPidTree(pid) {
  if (!pid || pid <= 0) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch {
    /* ignore */
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

function startServe(exe, port, password, workspace, xdg, cache) {
  ensureDir(HOME);
  const outFd = openSync(LOG_OUT, "w");
  const errFd = openSync(LOG_ERR, "w");
  const child = spawn(
    exe,
    ["serve", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: workspace,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: xdg,
        XDG_CACHE_HOME: cache,
        OPENCODE_PASSWORD: password,
      },
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

function b64Key(value) {
  return Buffer.from(String(value), "utf8").toString("base64").replace(/=+$/, "");
}

function sessionDeepLink(port, sessionId) {
  const server = `http://127.0.0.1:${port}`;
  return `${server}/server/${b64Key(server)}/session/${sessionId}`;
}

/** 若工作区尚未登记，创建 session（OpenCode 会顺带登记 project）；已有则复用最新一条。 */
async function ensureWorkspaceSession(port, password, workspace) {
  const directory = resolve(workspace);
  if (!existsSync(directory)) {
    throw new Error(`workspace does not exist: ${directory}`);
  }
  const auth = Buffer.from(`opencode:${password}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
  };
  const q = new URLSearchParams({
    directory,
    limit: "1",
    order: "desc",
    parentID: "null",
    archived: "false",
  });
  const listRes = await fetch(`http://127.0.0.1:${port}/api/session?${q}`, {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!listRes.ok) {
    throw new Error(
      `list sessions failed (${listRes.status}): ${await listRes.text()}`,
    );
  }
  const list = await listRes.json();
  const existingId = list?.data?.[0]?.id;
  if (existingId) {
    return { sessionId: existingId, directory, created: false };
  }

  const createRes = await fetch(`http://127.0.0.1:${port}/api/session`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      location: { directory },
      title: basename(directory) || "CIZHENYU",
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!createRes.ok) {
    throw new Error(
      `create session failed (${createRes.status}): ${await createRes.text()}`,
    );
  }
  const created = await createRes.json();
  const sessionId = created?.data?.id;
  if (!sessionId) throw new Error("create session missing id");
  return { sessionId, directory, created: true };
}

async function main() {
  const xdg = process.env.XDG_CONFIG_HOME?.trim() || join(HOME, "config");
  const cache = process.env.XDG_CACHE_HOME?.trim() || join(HOME, "cache");
  ensureDir(join(xdg, "opencode"));
  ensureDir(cache);
  process.env.XDG_CONFIG_HOME = xdg;
  process.env.XDG_CACHE_HOME = cache;

  const exe = findCli();
  if (!exe) fail("未找到 opencode CLI，请先在 Deploy 安装 OpenCode Agent");

  const password = ensurePassword();
  process.env.OPENCODE_PASSWORD = password;
  const workspace = process.env.CIZHENYU_WORKSPACE?.trim() || process.cwd();

  let port = readPreferredPort();
  const pidRaw = existsSync(PID_FILE) ? Number(readFileSync(PID_FILE, "utf8").trim()) : 0;

  if (!(await apiInfoOk(port, password))) {
    if (pidRaw && processAlive(pidRaw)) {
      killPidTree(pidRaw);
      try {
        unlinkSync(PID_FILE);
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    port = await pickPort(port);
    if (await apiInfoOk(port, password)) {
      writeFileSync(PORT_FILE, String(port), "utf8");
    } else if (await portOpen(port)) {
      fail(`端口 ${port} 已被占用且不是本机 OpenCode 隔离服务`);
    } else {
      const pid = startServe(exe, port, password, workspace, xdg, cache);
      if (!(await waitReady(port, password))) {
        fail(`opencode serve 未就绪（pid ${pid}），见 ${LOG_ERR}`);
      }
    }
  }

  let sessionId = null;
  let sessionUrl = null;
  let sessionCreated = false;
  let sessionError = null;
  try {
    const ensured = await ensureWorkspaceSession(port, password, workspace);
    sessionId = ensured.sessionId;
    sessionUrl = sessionDeepLink(port, ensured.sessionId);
    sessionCreated = ensured.created;
  } catch (e) {
    sessionError = String(e?.message || e);
  }

  const connectUrl = await createPairUrl(port, password);
  ok({
    connectUrl,
    sessionUrl,
    sessionId,
    sessionCreated,
    sessionError,
    workspace,
    webUrl: `http://127.0.0.1:${port}/`,
    port,
    exePath: exe,
    homeDir: xdg,
  });
}

main().catch((e) => fail(String(e?.message || e)));
