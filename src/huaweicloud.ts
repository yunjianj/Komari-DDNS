const DNS_HOST = "dns.cn-north-4.myhuaweicloud.com";
export const HUAWEI_DEFAULT_LINE = "default_view";
export const HUAWEI_DEFAULT_TTL = 300;
export const HUAWEI_MAX_TTL = 2147483647;
export const HUAWEI_MAX_WEIGHT = 1000;

interface Credentials {
  accessKey: string;
  secretKey: string;
}

interface Page<T> {
  metadata?: { total_count: number };
  links?: { next?: string };
  [key: string]: T[] | { total_count: number } | { next?: string } | undefined;
}

interface LineOption {
  id: string;
  name: string;
}

interface LineChoice {
  category: string;
  path: LineOption[];
}

interface SystemLine extends LineOption {
  father_id: string;
}

interface CustomLine {
  line_id: string;
  name: string;
  status: string;
}

interface Recordset {
  id: string;
  name: string;
  type: string;
  line: string;
  ttl: number;
  weight?: number | null;
  records: string[];
  status: string;
  alias_target?: { resource_type?: string; resource_domain_name?: string } | null;
}

interface RecordOptions {
  domain: string;
  name: string;
  type: "A" | "AAAA";
  line: string;
  recordsetId?: string;
  ttl: number;
  weight?: number;
}

class HuaweiAPIError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, char =>
    "%" + char.charCodeAt(0).toString(16).toUpperCase(),
  );
}

async function request<T>(
  credentials: Credentials,
  method: "GET" | "POST" | "PUT",
  path: string,
  query: Record<string, string> = {},
  payload?: Record<string, unknown>,
): Promise<T> {
  const crypto = require("crypto");
  const sha256 = (input: string) => crypto.createHash("sha256").update(input).digest("hex");
  const date = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const queryString = Object.keys(query).sort().map(key => encode(key) + "=" + encode(query[key])).join("&");
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const headers: Record<string, string> = {
    host: DNS_HOST,
    "x-sdk-date": date,
  };
  if (body) headers["content-type"] = "application/json";
  const headerNames = Object.keys(headers).sort();
  const canonicalHeaders = headerNames.map(name => name + ":" + headers[name] + "\n").join("");
  const signedHeaders = headerNames.join(";");
  const canonicalRequest = [method, path + "/", queryString, canonicalHeaders, signedHeaders, sha256(body)].join("\n");
  const algorithm = "SDK-HMAC-SHA256";
  const signature = crypto.createHmac("sha256", credentials.secretKey)
    .update([algorithm, date, sha256(canonicalRequest)].join("\n")).digest("hex");
  headers.authorization = `${algorithm} Access=${credentials.accessKey}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${DNS_HOST}${path}${queryString ? "?" + queryString : ""}`, {
    method,
    headers,
    body: body || undefined,
    redirect: "error",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.error_code || data.code) {
    const code = data?.error_code || data?.code;
    const detail = data?.error_msg || data?.message;
    throw new HuaweiAPIError(response.status, `华为云 DNS ${method} ${path} 返回 HTTP ${response.status}` +
      (code ? ` (${code})` : "") + (detail ? `：${detail}` : ""));
  }
  return data;
}

async function listPages<T>(
  credentials: Credentials,
  path: string,
  field: string,
  query: Record<string, string> = {},
  limit = 100,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  while (true) {
    const page = await request<Page<T>>(credentials, "GET", path, { ...query, limit: String(limit), offset: String(offset) });
    const rows = page[field];
    if (!Array.isArray(rows)) throw new Error(`华为云 DNS 响应缺少 ${field} 列表`);
    items.push(...rows);
    if (!rows.length) break;
    offset += rows.length;
    const total = page.metadata?.total_count;
    if (!page.links?.next && (typeof total === "number" ? offset >= total : rows.length < limit)) break;
  }
  return items;
}

async function findZone(credentials: Credentials, domain: string): Promise<string> {
  const zones = await listPages<LineOption>(credentials, "/v2/zones", "zones", {
    type: "public", name: domain + ".", search_mode: "equal",
  });
  const matches = zones.filter(zone => zone.name.toLowerCase().replace(/\.$/, "") === domain);
  if (matches.length !== 1 || !matches[0].id) throw new Error(`华为云 DNS 无法唯一定位公网解析域名 ${domain}`);
  return matches[0].id;
}

function systemLineChoices(lines: SystemLine[]): LineChoice[] {
  const categories = new Set(["DEFAULT", "ISP", "REGION"]);
  const byId = new Map(lines.map(line => [line.id, line]));
  return Array.from(byId.values()).filter(line => !categories.has(line.id)).map(line => {
    const path: LineOption[] = [{ id: line.id, name: line.name }];
    const seen = new Set([line.id]);
    let parentId = line.father_id;
    while (parentId && !categories.has(parentId) && !seen.has(parentId)) {
      const parent = byId.get(parentId);
      if (!parent) break;
      path.unshift({ id: parent.id, name: parent.name });
      seen.add(parentId);
      parentId = parent.father_id;
    }
    const category = line.id === HUAWEI_DEFAULT_LINE ? "DEFAULT" : categories.has(parentId) ? parentId : "OTHER";
    // Huawei may prefix a child label with its carrier or region, which is
    // already shown in a preceding selector.
    const labels = new Set<string>();
    const displayPath = path.map(({ id, name }) => {
      const parts = name.split("_");
      while (parts.length > 1 && labels.has(parts[0])) parts.shift();
      const label = parts.join("_");
      labels.add(label);
      return { id, name: label };
    });
    return { category, path: displayPath };
  });
}

export async function listHuaweiLines(credentials: Credentials, domain: string) {
  await findZone(credentials, domain);
  const warnings: string[] = [];
  async function optionalLines(path: string, field: string, category: string, permission: string): Promise<LineChoice[]> {
    try {
      const lines = await listPages<CustomLine>(credentials, path, field);
      return lines.filter(line => line.status === "ACTIVE" && line.line_id)
        .map(line => ({ category, path: [{ id: line.line_id, name: line.name }] }));
    } catch (e) {
      warnings.push(e instanceof HuaweiAPIError && e.status === 403
        ? `缺少 ${permission} 权限`
        : `无法加载${category === "CUSTOM" ? "自定义线路" : "线路分组"}（${e instanceof Error ? e.message : String(e)}）`);
      return [];
    }
  }
  const [system, custom, groups] = await Promise.all([
    listPages<SystemLine>(credentials, "/v2.1/system-lines", "lines", { locale: "zh-cn" }, 1000),
    optionalLines("/v2.1/customlines", "lines", "CUSTOM", "dns:customLine:list"),
    optionalLines("/v2.1/linegroups", "linegroups", "GROUP", "dns:lineGroup:list"),
  ]);
  return { lines: [...systemLineChoices(system), ...custom, ...groups], warning: warnings.join("；") };
}

export async function syncHuaweiRecord(
  credentials: Credentials,
  options: RecordOptions,
  ip: string,
  claimed: Set<string>,
  recentlyCreatedId?: string,
): Promise<{ action: "create" | "update" | "skip"; createdId?: string }> {
  const { domain, name, type, line, recordsetId, ttl, weight } = options;
  const zoneId = await findZone(credentials, domain);
  const path = `/v2.1/zones/${encode(zoneId)}/recordsets`;
  const fqdn = name + ".";
  const matchesRecord = (record: Recordset) => record.name.toLowerCase().replace(/\.$/, "") === name &&
    record.type === type && record.line === line;
  let record: Recordset | undefined;
  if (recordsetId) {
    record = await request<Recordset>(credentials, "GET", path + "/" + encode(recordsetId));
    if (record.id !== recordsetId || !matchesRecord(record)) {
      throw new Error("华为云记录集 ID 与所选主机名、类型或线路不匹配");
    }
  } else {
    const matches = (await listPages<Recordset>(credentials, path, "recordsets", {
      name: fqdn, type, line_id: line, search_mode: "equal",
    })).filter(matchesRecord);
    if (matches.length > 1) throw new Error("华为云 DNS 同名、同类型、同线路有多条记录集，请填写记录集 ID");
    record = matches[0];
    if (!record && recentlyCreatedId) {
      // An accepted creation can take time to appear in the recordset list.
      record = await request<Recordset>(credentials, "GET", path + "/" + encode(recentlyCreatedId));
      if (record.id !== recentlyCreatedId || !matchesRecord(record)) {
        throw new Error("刚创建的华为云记录集与当前配置不匹配");
      }
    }
  }

  if (!record) {
    const created = await request<Recordset>(credentials, "POST", path, {}, {
      name: fqdn, type, line, ttl, weight, records: [ip],
    });
    claimed.add(zoneId + "#" + created.id);
    return { action: "create", createdId: created.id };
  }

  const key = zoneId + "#" + record.id;
  if (claimed.has(key)) throw new Error("多条 DDNS 配置指向同一个华为云记录集");
  claimed.add(key);
  if (record.alias_target?.resource_type || record.alias_target?.resource_domain_name ||
      !Array.isArray(record.records) || record.records.length !== 1) {
    throw new Error("华为云 DDNS 需要仅含一个 IP 的非别名记录集");
  }
  const ipChanged = record.records[0] !== ip;
  const ttlChanged = record.ttl !== ttl;
  const weightChanged = weight !== undefined && record.weight !== weight;
  if (!ipChanged && !ttlChanged && !weightChanged) return { action: "skip" };
  if (record.status && record.status !== "ACTIVE" && record.status !== "DISABLE") {
    throw new Error(`华为云记录集当前状态为 ${record.status}，暂时无法更新`);
  }
  // The update API retains omitted values and does not accept the line field.
  await request(credentials, "PUT", path + "/" + encode(record.id), {}, {
    name: fqdn, type,
    records: ipChanged ? [ip] : undefined,
    ttl: ttlChanged ? ttl : undefined,
    weight: weightChanged ? weight : undefined,
  });
  return { action: "update" };
}
