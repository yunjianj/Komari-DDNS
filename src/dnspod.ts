const DNSPOD_HOST = "dnspod.tencentcloudapi.com";
export const DNSPOD_DEFAULT_TTL = 600;

interface Credentials {
  secretId: string;
  secretKey: string;
}

interface LineItem {
  LineName: string;
  LineId: string | null;
  Useful: boolean;
  SubGroup?: LineItem[] | null;
}

interface LineOption {
  id: string;
  name: string;
}

interface DNSPodLine {
  id: string | null;
  name: string;
  value: string;
  path: LineOption[];
}

interface RecordOptions {
  domain: string;
  subdomain: string;
  type: "A" | "AAAA";
  line: string;
  recordId?: number;
  weight?: number;
  ttl?: number;
}

interface DNSPodRecord {
  RecordId: number;
  Name: string;
  Type: string;
  Line: string;
  LineId: string;
  Value: string;
  Weight?: number | null;
  TTL: number;
}

class DNSPodError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "DNSPodError";
  }
}

async function request<T>(
  credentials: Credentials,
  action: string,
  params: object,
): Promise<T> {
  // Load the host's crypto module only when a DNSPod record is configured.
  const crypto = require("crypto");
  const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
  const hmac = (key: any, value: string) => crypto.createHmac("sha256", key).update(value);
  const body = JSON.stringify(params);
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const contentType = "application/json; charset=utf-8";
  const scope = `${date}/dnspod/tc3_request`;
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalHeaders =
    `content-type:${contentType}\nhost:${DNSPOD_HOST}\nx-tc-action:${action.toLowerCase()}\n`;
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, hash(body)].join("\n");
  const algorithm = "TC3-HMAC-SHA256";
  const stringToSign = [algorithm, timestamp, scope, hash(canonicalRequest)].join("\n");
  const dateKey = hmac("TC3" + credentials.secretKey, date).digest();
  const serviceKey = hmac(dateKey, "dnspod").digest();
  const signingKey = hmac(serviceKey, "tc3_request").digest();
  const signature = hmac(signingKey, stringToSign).digest("hex");

  const response = await fetch(`https://${DNSPOD_HOST}/`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "X-TC-Action": action,
      "X-TC-Version": "2021-03-23",
      "X-TC-Timestamp": String(timestamp),
      Authorization: `${algorithm} Credential=${credentials.secretId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  });
  const data = (await response.json())?.Response;
  if (data?.Error) {
    throw new DNSPodError(
      data.Error.Code,
      `${action}: ${data.Error.Code} ${data.Error.Message} (RequestId: ${data.RequestId})`,
    );
  }
  if (!response.ok || !data) {
    throw new Error(`DNSPod ${action}: HTTP ${response.status} 或响应格式异常`);
  }
  return data;
}

function isLineId(line: string): boolean {
  return /^\d+(?:=\d+)*$/.test(line);
}

export async function listDNSPodLines(credentials: Credentials, domain: string) {
  const { LineList } = await request<{ LineList: LineItem[] }>(
    credentials, "DescribeRecordLineCategoryList", { Domain: domain },
  );
  if (!Array.isArray(LineList)) throw new Error("DNSPod 线路列表响应格式异常");
  const lines = new Map<string, DNSPodLine>();
  function collect(items: LineItem[], parents: LineOption[]): void {
    for (const { LineName: name, LineId: id, Useful, SubGroup } of items) {
      const key = id || name;
      // DNSPod can repeat a parent line among its own children.
      const path = name && parents[parents.length - 1]?.id !== key
        ? [...parents, { id: key, name }]
        : parents;
      if (Useful && name) {
        const value = id === "0" ? "默认" : id && isLineId(id) ? id : name;
        lines.set(JSON.stringify(path.map(part => part.id)), { id, name, value, path });
      }
      if (SubGroup) collect(SubGroup, path);
    }
  }
  collect(LineList, []);
  return Array.from(lines.values());
}

async function findRecords(
  credentials: Credentials,
  options: RecordOptions,
  lineId: boolean,
): Promise<DNSPodRecord[]> {
  const records: DNSPodRecord[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    let page;
    try {
      page = await request<{ RecordList: DNSPodRecord[] }>(
        credentials,
        "DescribeRecordList",
        {
          Domain: options.domain,
          SubDomain: options.subdomain,
          RecordType: options.type,
          ...(lineId ? { RecordLineId: options.line } : { RecordLine: options.line }),
          Offset: offset,
          Limit: limit,
        },
      );
    } catch (e) {
      if (e instanceof DNSPodError && e.code === "ResourceNotFound.NoDataOfRecord") break;
      throw e;
    }
    const items = page.RecordList;
    if (!Array.isArray(items)) throw new Error("DNSPod 解析记录列表响应格式异常");
    for (const record of items) {
      if (
        record.Name.toLowerCase() === options.subdomain &&
        record.Type === options.type &&
        (lineId ? record.LineId : record.Line) === options.line
      ) {
        records.push(record);
        if (records.length === 2) return records;
      }
    }
    if (items.length < limit) break;
  }
  return records;
}

async function describeRecord(
  credentials: Credentials,
  domain: string,
  recordId: number,
): Promise<DNSPodRecord> {
  const { RecordInfo: info } = await request<{
    RecordInfo: {
      Id: number;
      SubDomain: string;
      RecordType: string;
      RecordLine: string;
      RecordLineId: string;
      Value: string;
      Weight?: number | null;
      TTL: number;
    };
  }>(credentials, "DescribeRecord", { Domain: domain, RecordId: recordId });
  return {
    RecordId: info.Id,
    Name: info.SubDomain,
    Type: info.RecordType,
    Line: info.RecordLine,
    LineId: info.RecordLineId,
    Value: info.Value,
    Weight: info.Weight,
    TTL: info.TTL,
  };
}

export async function syncDNSPodRecord(
  credentials: Credentials,
  options: RecordOptions,
  ip: string,
  claimedRecords: Set<string>,
  recentlyCreatedId?: number,
): Promise<{ action: "create" | "update" | "skip"; id: number }> {
  const { domain, subdomain, type, line, recordId, weight, ttl } = options;
  const lineId = isLineId(line);
  // An explicit ID can move a record to a new line. For records matched by
  // name, keep other lines untouched.
  let record: DNSPodRecord | undefined;
  if (recordId !== undefined) {
    record = await describeRecord(credentials, domain, recordId);
    if (record.RecordId !== recordId || record.Name.toLowerCase() !== subdomain || record.Type !== type) {
      throw new Error("DNSPod 记录 ID 与配置的主机名或记录类型不匹配");
    }
  } else {
    const matches = await findRecords(credentials, options, lineId);
    if (matches.length > 1) {
      throw new Error("DNSPod 同名、同类型、同线路有多条记录，请填写 DNSPod 记录 ID");
    }
    record = matches[0];
    // DNSPod may take up to 30 seconds to index a newly created record.
    if (!record && recentlyCreatedId !== undefined) {
      record = await describeRecord(credentials, domain, recentlyCreatedId);
      if (record.Name.toLowerCase() !== subdomain || record.Type !== type ||
          (lineId ? record.LineId : record.Line) !== line) {
        throw new Error("DNSPod 刚创建的记录已变更，请稍后重试");
      }
    }
  }

  if (!record) {
    const created = await request<{ RecordId: number }>(credentials, "CreateRecord", {
      Domain: domain,
      SubDomain: subdomain,
      RecordType: type,
      RecordLine: lineId ? "默认" : line,
      ...(lineId ? { RecordLineId: line } : {}),
      Value: ip,
      TTL: ttl ?? DNSPOD_DEFAULT_TTL,
      Weight: weight,
    });
    claimedRecords.add(`${domain}#${created.RecordId}`);
    return { action: "create", id: created.RecordId };
  }

  const claim = `${domain}#${record.RecordId}`;
  if (claimedRecords.has(claim)) throw new Error("多条 DDNS 配置指向同一个 DNSPod 记录 ID");
  claimedRecords.add(claim);

  const fields: { Key: string; Value: string }[] = [];
  if (record.Value !== ip) fields.push({ Key: "value", Value: ip });
  if ((lineId ? record.LineId : record.Line) !== line) {
    fields.push({ Key: lineId ? "record_line_id" : "record_line", Value: line });
  }
  if (weight !== undefined && weight !== (record.Weight ?? 0)) {
    fields.push({ Key: "weight", Value: String(weight) });
  }
  if (ttl !== undefined && ttl !== record.TTL) {
    fields.push({ Key: "ttl", Value: String(ttl) });
  }
  if (fields.length === 0) return { action: "skip", id: record.RecordId };
  await request(credentials, "ModifyRecordFields", {
    Domain: domain,
    RecordId: record.RecordId,
    FieldList: fields,
  });
  return { action: "update", id: record.RecordId };
}
