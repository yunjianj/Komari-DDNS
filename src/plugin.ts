import { definePlugin, server, jsonResponse } from "@komari-monitor/plugin-sdk";

import { DNSPOD_DEFAULT_TTL, listDNSPodLines, syncDNSPodRecord } from "./dnspod";

// Host modules (available when permissions.node is enabled). Kept as dynamic
// require so the bundler leaves them external and the runtime resolves them.
const fs = require("fs");
const path = require("path");

interface PluginConfig {
  api_token?: string;
  tencent_secret_id?: string;
  tencent_secret_key?: string;
  interval: number;
  notify: boolean;
  records?: string; // legacy JSON textbox, only used for one-time seeding
}

interface RecordConfig {
  provider?: "dnspod";
  domain?: string;
  record_line?: string;
  record_line_name?: string;
  record_id?: number;
  weight?: number;
  zone_id?: string;
  record_name: string;
  record_type: "A" | "AAAA";
  source_node: string[];
  ttl?: number;
  ttl_seconds?: number;
  proxied: boolean;
  comment?: string;
  api_token?: string;
}

interface SyncContext {
  nodes: Record<string, any>;
  statuses: Record<string, any>;
  claimedDNSPodRecords: Set<string>;
}

const CF_API = "https://api.cloudflare.com/client/v4";
const RECORDS_FILE = path.join(__storageDir__, "records.json");

function storageFile(): string {
  return path.join(__storageDir__, "state.json");
}

const LOGS_FILE = path.join(__storageDir__, "logs.json");
const MAX_LOGS = 500;

function isValidStateEntry(v: any): boolean {
  return (
    v &&
    typeof v.record_name === "string" &&
    v.record_name &&
    (v.record_type === "A" || v.record_type === "AAAA")
  );
}

function cleanState(state: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(state || {})) {
    if (isValidStateEntry(state[key])) {
      cleaned[key] = state[key];
    }
  }
  return cleaned;
}

function loadState(): Record<string, any> {
  try {
    if (fs.existsSync(storageFile())) {
      const raw = JSON.parse(fs.readFileSync(storageFile(), "utf8"));
      return cleanState(raw);
    }
  } catch (e) {
    console.error("[cf-ddns] load state failed:", e);
  }
  return {};
}

function saveState(state: Record<string, any>): void {
  try {
    fs.writeFileSync(storageFile(), JSON.stringify(cleanState(state), null, 2));
  } catch (e) {
    console.error("[cf-ddns] save state failed:", e);
  }
}

function loadRecords(): RecordConfig[] {
  if (fs.existsSync(RECORDS_FILE)) {
    try {
      const arr = JSON.parse(fs.readFileSync(RECORDS_FILE, "utf8"));
      if (Array.isArray(arr)) return arr;
    } catch (e) {
      console.error("[cf-ddns] load records failed:", e);
    }
  }
  return [];
}

function saveRecords(arr: RecordConfig[]): void {
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(arr, null, 2));
}

// Mask sentinels used when returning records to the admin frontend. The real
// `api_token` is never sent to the browser; a record that has one is marked
// with TOKEN_SET so the editor can preserve it on save without leaking it.
const TOKEN_SET = "***SET***";

// Return a copy safe to expose to the frontend: the per-record `api_token`, if
// present, is replaced with TOKEN_SET; otherwise the field is omitted.
function publicRecord(r: RecordConfig): RecordConfig {
  const out: RecordConfig = { ...r };
  if (r.api_token) {
    out.api_token = TOKEN_SET;
  } else {
    delete out.api_token;
  }
  return out;
}

// Resolve the active record list: prefer the managed storage file, and seed it
// once from the legacy `records` config textbox if storage is empty.
function getRecords(config: PluginConfig): RecordConfig[] {
  const stored = loadRecords();
  if (stored.length > 0) return stored;
  const seeded = parseRecords(config);
  if (Array.isArray(seeded) && seeded.length > 0) {
    saveRecords(seeded);
    return seeded;
  }
  return stored;
}

function recordKey(rec: RecordConfig): string {
  if (rec.provider !== "dnspod") return `${rec.record_name}#${rec.record_type}`;
  const target = rec.record_id ? `id:${rec.record_id}` : `line:${rec.record_line || "默认"}`;
  return `dnspod:${rec.domain}#${rec.record_name}#${rec.record_type}#${target}`;
}

function normalizeDNSName(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\.$/, "");
}

function dnsPodCredentials(config: PluginConfig) {
  const secretId = String(config.tencent_secret_id ?? "").trim();
  const secretKey = String(config.tencent_secret_key ?? "").trim();
  if (!secretId || !secretKey) throw new Error("请在插件配置中填写腾讯云 SecretId 和 SecretKey");
  return { secretId, secretKey };
}

function configuredDNSPodTTL(rec: RecordConfig): number | undefined {
  // The old shared TTL field used 1 as an automatic sentinel. The new
  // DNSPod field can represent an explicit one-second TTL.
  return rec.ttl_seconds !== undefined ? rec.ttl_seconds : rec.ttl === 1 ? undefined : rec.ttl;
}

function normalizeDNSPodRecord(rec: RecordConfig): RecordConfig {
  const domain = normalizeDNSName(rec.domain);
  const name = normalizeDNSName(rec.record_name);
  if (!domain.includes(".") || (name !== domain && !name.endsWith("." + domain))) {
    throw new Error("解析域名必须是记录名称本身或其上级域名");
  }
  if (rec.weight !== undefined &&
      (!Number.isInteger(rec.weight) || rec.weight < 0 || rec.weight > 100)) {
    throw new Error("权重必须是 0 到 100 的整数，或留空");
  }
  if (rec.record_id !== undefined &&
      (!Number.isSafeInteger(rec.record_id) || rec.record_id < 1)) {
    throw new Error("DNSPod 记录 ID 必须是正整数，或留空");
  }
  const ttl = configuredDNSPodTTL(rec);
  if (ttl !== undefined && (!Number.isInteger(ttl) || ttl < 1 || ttl > 604800)) {
    throw new Error("DNSPod TTL 必须为 1 到 604800 秒的整数");
  }
  const line = String(rec.record_line ?? "").trim();
  return { ...rec, domain, record_name: name, record_line: !line || line === "0" ? "默认" : line, ttl: undefined, ttl_seconds: ttl };
}

// Parse the legacy `records` textbox (a JSON array of record objects).
function parseRecords(config: PluginConfig): RecordConfig[] | { error: string } {
  const raw = config.records;
  if (typeof raw !== "string" || !raw.trim()) {
    return { error: "records 配置为空" };
  }
  let arr: any;
  try {
    arr = JSON.parse(raw);
  } catch (e: any) {
    return { error: "records 不是合法 JSON：" + e.message };
  }
  if (!Array.isArray(arr)) {
    return { error: "records 必须是一个 JSON 数组" };
  }
  return arr.map((r: any) => ({
    zone_id: String(r.zone_id || ""),
    record_name: String(r.record_name || ""),
    record_type: r.record_type === "AAAA" ? "AAAA" : "A",
    source_node: Array.isArray(r.source_node)
      ? r.source_node.map((x: any) => String(x))
      : [],
    ttl: Number(r.ttl) || 1,
    proxied: !!r.proxied,
    comment: r.comment ? String(r.comment) : undefined,
    api_token: r.api_token ? String(r.api_token) : undefined,
  }));
}

async function resolveTargetIp(
  ctx: SyncContext,
  sourceNode: string[],
  recordType: string,
): Promise<{ uuid: string; name: string; ip: string } | null> {
  for (const uuid of sourceNode || []) {
    const node = ctx.nodes[uuid];
    if (!node) {
      console.warn(`[cf-ddns] node ${uuid} not found`);
      continue;
    }
    const st = ctx.statuses[uuid];
    if (st && st.online === false) {
      console.log(`[cf-ddns] node ${node.name} (${uuid}) is offline, skipping`);
      continue;
    }
    const ip = recordType === "AAAA" ? node.ipv6 : node.ipv4;
    if (ip) {
      return { uuid, name: node.name, ip };
    }
    console.log(`[cf-ddns] node ${node.name} has no ${recordType} address`);
  }
  return null;
}

async function cloudflareList(
  token: string,
  zone: string,
  name: string,
  type: string,
): Promise<any | null> {
  const url = `${CF_API}/zones/${zone}/dns_records?name=${encodeURIComponent(
    name,
  )}&type=${type}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await resp.json();
  if (!data.success) {
    throw new Error("Cloudflare list failed: " + JSON.stringify(data.errors));
  }
  return data.result && data.result.length ? data.result[0] : null;
}

async function cloudflareCreate(
  token: string,
  zone: string,
  payload: any,
): Promise<any> {
  const url = `${CF_API}/zones/${zone}/dns_records`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!data.success) {
    throw new Error("Cloudflare create failed: " + JSON.stringify(data.errors));
  }
  return data.result;
}

async function cloudflareUpdate(
  token: string,
  zone: string,
  id: string,
  payload: any,
): Promise<any> {
  const url = `${CF_API}/zones/${zone}/dns_records/${id}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!data.success) {
    throw new Error("Cloudflare update failed: " + JSON.stringify(data.errors));
  }
  return data.result;
}

// In-memory cache of zones per token to avoid repeated lookups within a run.
const zoneCache: Record<string, { zones: any[]; at: number }> = {};

async function cloudflareListZones(token: string): Promise<any[]> {
  const zones: any[] = [];
  let page = 1;
  while (true) {
    const url = `${CF_API}/zones?per_page=100&page=${page}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json();
    if (!data.success) {
      throw new Error(
        "Cloudflare list zones failed: " + JSON.stringify(data.errors),
      );
    }
    zones.push(...(data.result || []));
    const info = data.result_info;
    if (!info || page >= info.total_pages) break;
    page++;
  }
  return zones;
}

async function getZones(token: string): Promise<any[]> {
  const cached = zoneCache[token];
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.zones;
  const zones = await cloudflareListZones(token);
  zoneCache[token] = { zones, at: Date.now() };
  return zones;
}

// Pick the most specific zone whose name is the record's apex (or a suffix).
function zoneForRecord(
  zones: any[],
  recordName: string,
): any | null {
  let best: any = null;
  for (const z of zones || []) {
    const name = z.name;
    if (
      recordName === name ||
      recordName.endsWith("." + name)
    ) {
      if (!best || name.length > best.name.length) best = z;
    }
  }
  return best;
}

function appendLog(entry: any): void {
  try {
    let arr: any[] = [];
    if (fs.existsSync(LOGS_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(LOGS_FILE, "utf8"));
        if (Array.isArray(raw)) arr = raw;
      } catch {
        arr = [];
      }
    }
    arr.push(entry);
    if (arr.length > MAX_LOGS) arr = arr.slice(arr.length - MAX_LOGS);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(arr));
  } catch (e) {
    console.error("[cf-ddns] appendLog failed:", e);
  }
}

function logSync(
  rec: any,
  action: "create" | "update" | "skip" | "error" | "sync" | "delete" | "add" | "edit",
  success: boolean,
  detail: string,
  ip?: string,
): void {
  appendLog({
    time: new Date().toISOString(),
    record_name: rec.record_name,
    record_type: rec.record_type,
    provider: rec.provider,
    record_line: rec.record_line,
    record_id: rec.record_id,
    action,
    success,
    detail,
    ip,
  });
}

async function syncRecord(
  config: PluginConfig,
  rec: RecordConfig,
  ctx: SyncContext,
): Promise<Record<string, any>> {
  const key = recordKey(rec);
  const result: Record<string, any> = {
    key,
    record_name: rec.record_name,
    record_type: rec.record_type,
    zone_id: rec.zone_id,
  };

  try {
    if (!rec.record_name || !rec.source_node?.length) {
      throw new Error("配置不完整（缺少记录名称或来源节点）");
    }
    const target = await resolveTargetIp(ctx, rec.source_node, rec.record_type);
    if (!target) {
      result.skipped = "no valid node IP";
      logSync(rec, "skip", true, "无可用节点公网 IP");
      return result;
    }

    const previous = loadState()[key] || {};
    let createdId: number | undefined;
    let action: "create" | "update" | "skip";
    let skipDetail: string;
    if (rec.provider === "dnspod") {
      const dns = normalizeDNSPodRecord(rec);
      const domain = dns.domain!;
      const synced = await syncDNSPodRecord(
        dnsPodCredentials(config),
        {
          domain,
          subdomain: dns.record_name === domain ? "@" : dns.record_name.slice(0, -(domain.length + 1)),
          type: dns.record_type,
          line: dns.record_line!,
          recordId: dns.record_id,
          weight: dns.weight,
          ttl: dns.ttl_seconds,
        },
        target.ip,
        ctx.claimedDNSPodRecords,
        Date.now() - previous.dnspod_created_at < 30_000 ? previous.dnspod_created_id : undefined,
      );
      action = synced.action;
      if (action === "create") createdId = synced.id;
      skipDetail = "DNSPod 解析记录已符合配置";
    } else {
      const token = rec.api_token || config.api_token;
      if (!token) throw new Error("请配置 Cloudflare API Token");
      action = await syncCloudflareRecord(token, rec, target.ip);
      skipDetail = "IP 与代理状态均无变化";
    }

    result.current_ip = target.ip;
    if (action === "skip") {
      result.updated = false;
      result.skipped = "no change";
      logSync(rec, "skip", true, skipDetail);
    } else {
      const verb = action === "create" ? "创建" : "更新";
      result[action === "create" ? "created" : "updated"] = true;
      logSync(rec, action, true, `${verb} DNS 记录 → ${target.ip}`, target.ip);
    }

    const now = new Date().toISOString();
    const state = loadState();
    state[key] = {
      record_name: rec.record_name,
      record_type: rec.record_type,
      last_ip: target.ip,
      last_node: target.name,
      last_checked_at: now,
      last_update_at: action === "skip" ? previous.last_update_at : now,
      dnspod_created_id: createdId ?? previous.dnspod_created_id,
      dnspod_created_at: createdId === undefined ? previous.dnspod_created_at : Date.now(),
    };
    saveState(state);
    if (action !== "skip" && config.notify) {
      await sendNotify(config, rec, target, action === "create" ? "创建" : "更新");
    }
  } catch (e) {
    result.error = String(e);
    logSync(rec, "error", false, result.error);
  }
  return result;
}

async function syncCloudflareRecord(
  token: string,
  rec: RecordConfig,
  ip: string,
): Promise<"create" | "update" | "skip"> {
  let zoneId = rec.zone_id;
  if (!zoneId) {
    const zone = zoneForRecord(await getZones(token), rec.record_name);
    if (!zone) {
      throw new Error(`无法自动解析 Zone ID（记录名 ${rec.record_name} 在 Cloudflare 账号下找不到对应域名，可在记录中手动填写 zone_id 覆盖）`);
    }
    zoneId = zone.id as string;
  }

  const record = await cloudflareList(token, zoneId, rec.record_name, rec.record_type);
  const payload = {
    type: rec.record_type,
    name: rec.record_name,
    content: ip,
    ttl: rec.ttl || 1,
    proxied: !!rec.proxied,
  };
  if (!record) {
    await cloudflareCreate(token, zoneId, payload);
    return "create";
  }
  if (record.content === ip && record.proxied === payload.proxied) return "skip";
  await cloudflareUpdate(token, zoneId, record.id, payload);
  return "update";
}

// Send a well-formed notification so the title, event type and associated
// server render correctly across all channels (Telegram / JS / etc.).
async function sendNotify(
  config: PluginConfig,
  rec: any,
  target: { uuid: string; name: string; ip: string },
  verb: string,
): Promise<void> {
  if (!config.notify) return;
  try {
    await server.call("admin:sendNotification", {
      event: {
        event: "DDNS",
        emoji: "🌐",
        message: `DDNS ${verb}：${rec.record_name}${rec.provider === "dnspod" ? ` [${rec.record_line || "默认"}]` : ""} → ${target.ip}（节点 ${target.name}）`,
        time: new Date().toISOString(),
        clients: [{ uuid: target.uuid }],
      },
    });
  } catch (e) {
    console.warn("[cf-ddns] notify failed:", e);
  }
}

// Manual and scheduled syncs share a run to avoid concurrent DNS writes.
let activeSync: Promise<Record<string, any>> | undefined;

function syncOnce(): Promise<Record<string, any>> {
  if (!activeSync) {
    activeSync = syncAllRecords().finally(() => { activeSync = undefined; });
  }
  return activeSync;
}

async function syncAllRecords(): Promise<Record<string, any>> {
  const config = (await server.getConfig()) as unknown as PluginConfig;
  const list = getRecords(config);
  if (list.length === 0) {
    return { ok: false, error: "尚未配置任何 DDNS 记录", records: [] };
  }

  const uuids = new Set<string>();
  for (const r of list) {
    const sn = r.source_node && r.source_node.length ? r.source_node : [];
    for (const u of sn) uuids.add(u);
  }

  const nodes = (await server.call("common:getNodes")) as Record<string, any>;
  let statuses: Record<string, any> = {};
  try {
    statuses = (await server.call("common:getNodesLatestStatus", {
      uuids: Array.from(uuids),
    })) as Record<string, any>;
  } catch (e) {
    console.warn(
      "[cf-ddns] getNodesLatestStatus failed, continuing without online check:",
      e,
    );
  }

  const ctx: SyncContext = { nodes, statuses, claimedDNSPodRecords: new Set() };
  const results: Record<string, any>[] = [];
  for (const r of list) {
    try {
      results.push(await syncRecord(config, r, ctx));
    } catch (e: any) {
      results.push({
        key: recordKey(r),
        record_name: r.record_name,
        record_type: r.record_type,
        error: String(e),
      });
    }
  }
  const errors = results.filter((r) => r.error).length;
  const skipped = results.filter((r) => !r.error && r.skipped).length;
  const changed = results.length - errors - skipped;
  const logParts = ["共 " + results.length + " 条"];
  if (changed > 0) logParts.push("更新/创建 " + changed + " 条");
  if (skipped > 0) logParts.push("跳过 " + skipped + " 条");
  if (errors > 0) logParts.push("失败 " + errors + " 条");
  logSync({}, "sync", errors === 0, "同步完成：" + logParts.join("，"));
  return {
    ok: errors === 0,
    total: results.length,
    errors,
    skipped,
    records: results,
  };
}

function cronExpression(minutes: number): string {
  const m = Math.max(1, Math.min(59, Math.floor(minutes || 5)));
  return `*/${m} * * * *`;
}

function isAdmin(req: any): boolean {
  const principal = req && req.context && req.context.principal;
  if (!principal) return false;
  const roles: string[] = principal.roles || [];
  return principal.type === "user" && roles.indexOf("admin") >= 0;
}

function parseQuery(req: any): Record<string, string> {
  const q: Record<string, string> = {};
  const u = (req && req.url) || "";
  const idx = u.indexOf("?");
  if (idx < 0) return q;
  u.slice(idx + 1)
    .split("&")
    .forEach((pair: string) => {
      if (!pair) return;
      const i = pair.indexOf("=");
      const k = i < 0 ? pair : pair.slice(0, i);
      const v = i < 0 ? "" : pair.slice(i + 1);
      try {
        q[decodeURIComponent(k)] = decodeURIComponent(v);
      } catch {
        /* ignore malformed */
      }
    });
  return q;
}

function loadLogs(): any[] {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(LOGS_FILE, "utf8"));
      if (Array.isArray(raw)) return raw;
    }
  } catch (e) {
    console.error("[cf-ddns] load logs failed:", e);
  }
  return [];
}

definePlugin({
  load() {
    server
      .getConfig()
      .then((cfg: any) => {
        const interval = (cfg && cfg.interval) || 5;
        server.cron(cronExpression(interval), () => {
          syncOnce().catch((e) => console.error("[cf-ddns] cron error:", e));
        });
        console.log(`[cf-ddns] scheduled sync every ${interval} minute(s)`);
      })
      .catch((e) => console.error("[cf-ddns] getConfig error:", e));

    // Current sync state per record.
    server.route("GET", "/cf-ddns/status", (req: any, res: any) => {
      if (!isAdmin(req)) {
        res.statusCode = 401;
        res.end("unauthorized");
        return;
      }
      jsonResponse(res, loadState());
    });

    // Run a sync across all records.
    server.route("POST", "/cf-ddns/sync", async (req: any, res: any) => {
      if (!isAdmin(req)) {
        res.statusCode = 401;
        res.end("unauthorized");
        return;
      }
      const r = await syncOnce();
      jsonResponse(res, r);
    });

    // Node list for the source-node picker.
    server.route("GET", "/cf-ddns/nodes", async (req: any, res: any) => {
      if (!isAdmin(req)) {
        res.statusCode = 401;
        res.end("unauthorized");
        return;
      }
      try {
        const nodes = (await server.call("common:getNodes")) as Record<
          string,
          any
        >;
        const list = Object.keys(nodes).map((u) => ({
          uuid: u,
          name: nodes[u] && nodes[u].name ? nodes[u].name : u,
        }));
        jsonResponse(res, list);
      } catch (e) {
        jsonResponse(res, { error: String(e) }, 500);
      }
    });

    server.route("GET", "/cf-ddns/dnspod-lines", async (req: any, res: any) => {
      if (!isAdmin(req)) {
        jsonResponse(res, { error: "请以管理员身份登录" }, 401);
        return;
      }
      const domain = normalizeDNSName(parseQuery(req).domain);
      if (domain.length > 253 || !/^[^\s./:@?#\\]+(?:\.[^\s./:@?#\\]+)+$/.test(domain)) {
        jsonResponse(res, { error: "请输入完整的 DNSPod 解析域名" }, 400);
        return;
      }
      try {
        const config = (await server.getConfig()) as unknown as PluginConfig;
        const lines = await listDNSPodLines(dnsPodCredentials(config), domain);
        jsonResponse(res, { lines });
      } catch (e) {
        jsonResponse(res, { error: e instanceof Error ? e.message : String(e) }, 502);
      }
    });

    // Read the current record list (managed in plugin storage).
    server.route("GET", "/cf-ddns/records", async (req: any, res: any) => {
      if (!isAdmin(req)) {
        res.statusCode = 401;
        res.end("unauthorized");
        return;
      }
      const config = (await server.getConfig()) as unknown as PluginConfig;
      jsonResponse(res, getRecords(config).map(publicRecord));
    });

    // Save the entire record list (add/edit/delete handled client-side).
    server.route("PUT", "/cf-ddns/records", async (req: any, res: any) => {
      if (!isAdmin(req)) {
        res.statusCode = 401;
        res.end("unauthorized");
        return;
      }
      let arr: any;
      try {
        arr = JSON.parse(req.body || "null");
      } catch (e) {
        jsonResponse(res, { error: "请求体不是合法 JSON" }, 400);
        return;
      }
      if (!Array.isArray(arr)) {
        jsonResponse(res, { error: "记录必须是 JSON 数组" }, 400);
        return;
      }

      // Load the previously stored records so we can validate and preserve the
      // (frontend-hidden) per-record api_token across edits.
      const oldRecs = loadRecords();
      const oldMap = new Map<string, any>();
      oldRecs.forEach((r: any) =>
        oldMap.set(recordKey(r), r),
      );

      const clean: RecordConfig[] = [];
      const dnsPodKeys = new Set<string>();
      for (let i = 0; i < arr.length; i++) {
        const r = arr[i] || {};
        const name = String(r.record_name || "").trim();
        try {
          if (!name.includes(".")) throw new Error("记录名称应为完整域名（FQDN）");
          if (r.provider && r.provider !== "cloudflare" && r.provider !== "dnspod") {
            throw new Error("未知的 DNS 提供商");
          }
          const rec: RecordConfig = {
            record_name: name,
            record_type: r.record_type === "AAAA" ? "AAAA" : "A",
            source_node: Array.isArray(r.source_node) ? r.source_node.map(String) : [],
            ttl: Number(r.ttl) || 1,
            proxied: !!r.proxied,
            comment: r.comment ? String(r.comment) : undefined,
          };
          if (r.provider === "dnspod") {
            const dns = normalizeDNSPodRecord({
              ...rec,
              provider: "dnspod",
              domain: r.domain,
              record_line: r.record_line,
              record_line_name: typeof r.record_line_name === "string" ? r.record_line_name : undefined,
              record_id: r.record_id,
              weight: r.weight,
              proxied: false,
              ttl: r.ttl,
              ttl_seconds: r.ttl_seconds,
            });
            const key = recordKey(dns);
            if (dnsPodKeys.has(key)) throw new Error("DNSPod 记录配置重复");
            if (dns.ttl_seconds === undefined) {
              const old = oldMap.get(key);
              dns.ttl_seconds = old ? configuredDNSPodTTL(old) : DNSPOD_DEFAULT_TTL;
            }
            dnsPodKeys.add(key);
            clean.push(dns);
          } else {
            rec.zone_id = String(r.zone_id || "");
            rec.api_token = r.api_token && r.api_token !== TOKEN_SET
              ? String(r.api_token)
              : oldMap.get(recordKey(rec))?.api_token;
            clean.push(rec);
          }
        } catch (e: any) {
          jsonResponse(res, { error: `第 ${i + 1} 条记录：${e.message}` }, 400);
          return;
        }
      }

      // Detect additions and deletions by diffing against the previously stored records.
      const oldKeys = new Set(oldMap.keys());
      const newKeys = new Set(
        clean.map((r: any) => recordKey(r)),
      );
      let added = 0;
      let removed = 0;
      let edited = 0;
      const changedFields = (a: any, b: any): string[] => {
        const out: string[] = [];
        const cmp = (k: string, label: string) => {
          if (String(a[k] ?? "") !== String(b[k] ?? "")) out.push(label);
        };
        cmp("zone_id", "Zone");
        cmp("record_line", "线路");
        cmp("weight", "权重");
        cmp("record_name", "名称");
        cmp("record_type", "类型");
        if (b.provider === "dnspod") {
          if (configuredDNSPodTTL(a) !== configuredDNSPodTTL(b)) out.push("TTL");
        } else {
          cmp("ttl", "TTL");
        }
        cmp("proxied", "代理");
        cmp("comment", "备注");
        const sa = (a.source_node || []).join(",");
        const sb = (b.source_node || []).join(",");
        if (sa !== sb) out.push("来源节点");
        if (!!a.api_token !== !!b.api_token) out.push("Token");
        return out;
      };
      clean.forEach((r: any) => {
        const key = recordKey(r);
        const old = oldMap.get(key);
        if (!old) {
          added++;
          logSync(r, "add", true, `新增记录 ${r.record_name} (${r.record_type})`);
        } else {
          const fields = changedFields(old, r);
          if (fields.length) {
            edited++;
            logSync(
              r,
              "edit",
              true,
              `修改记录 ${r.record_name} (${r.record_type})：${fields.join("、")}`,
            );
          }
        }
      });
      oldRecs.forEach((r: any) => {
        if (!newKeys.has(recordKey(r))) {
          removed++;
          logSync(r, "delete", true, `删除记录 ${r.record_name} (${r.record_type})`);
        }
      });
      saveRecords(clean);
      jsonResponse(res, { ok: true, total: clean.length, added, removed, edited });
    });

    // Query the sync operation log. Supports ?record=<name>&action=<action>&limit=<n>.
    server.route("GET", "/cf-ddns/logs", (req: any, res: any) => {
      if (!isAdmin(req)) {
        res.statusCode = 401;
        res.end("unauthorized");
        return;
      }
      const q = parseQuery(req);
      let logs = loadLogs();
      if (q.record) {
        logs = logs.filter((l) => l.record_name === q.record);
      }
      if (q.action) {
        logs = logs.filter((l) => l.action === q.action);
      }
      const limit = parseInt(q.limit || "100", 10);
      const n = isNaN(limit) || limit <= 0 ? 100 : Math.min(limit, 1000);
      const out = logs.slice(-n).reverse(); // newest first
      jsonResponse(res, { total: logs.length, logs: out });
    });

    // Clear the sync operation log.
    server.route("DELETE", "/cf-ddns/logs", (req: any, res: any) => {
      if (!isAdmin(req)) {
        res.statusCode = 401;
        res.end("unauthorized");
        return;
      }
      try {
        if (fs.existsSync(LOGS_FILE)) fs.unlinkSync(LOGS_FILE);
      } catch (e) {
        jsonResponse(res, { ok: false, error: String(e) }, 500);
        return;
      }
      jsonResponse(res, { ok: true });
    });
  },
});
