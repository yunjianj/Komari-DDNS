"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/@komari-monitor/plugin-sdk/src/manifest.js
  var require_manifest = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/manifest.js"(exports, module) {
      "use strict";
      function isObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
      }
      function hasText(value) {
        if (typeof value === "string") return value.trim().length > 0;
        if (!isObject(value)) return false;
        return Object.values(value).some((item) => typeof item === "string" && item.trim());
      }
      function isLocalPath(value) {
        if (typeof value !== "string" || !value) return false;
        const normalized = value.replaceAll("\\", "/");
        if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) return false;
        return !normalized.split("/").some((part) => part === "..") && normalized !== ".";
      }
      function validateManifest(manifest) {
        const errors = [];
        if (!isObject(manifest)) return ["manifest must be an object"];
        if (!hasText(manifest.name)) errors.push("name is required");
        if (typeof manifest.short !== "string" || !/^[A-Za-z0-9_-]+$/.test(manifest.short) || manifest.short === "default") {
          errors.push("short must contain only letters, digits, '_' and '-', and cannot be 'default'");
        }
        if (manifest.entry !== void 0 && !isLocalPath(manifest.entry)) {
          errors.push("entry must be a relative path inside the plugin directory");
        }
        if (manifest.icon !== void 0 && manifest.icon !== "" && !isLocalPath(manifest.icon)) {
          errors.push("icon must be a relative path inside the plugin directory");
        }
        if (manifest.version !== void 0 && typeof manifest.version !== "string") {
          errors.push("version must be a string");
        }
        if (manifest.komari !== void 0 && typeof manifest.komari !== "string") {
          errors.push("komari must be a string");
        }
        if (manifest.configuration !== void 0) {
          if (!isObject(manifest.configuration) || manifest.configuration.type !== "managed" || !Array.isArray(manifest.configuration.data)) {
            errors.push("configuration must be a managed configuration with a data array");
          } else {
            const itemTypes = /* @__PURE__ */ new Set(["string", "number", "select", "switch", "title", "textbox", "richtext", "nodes", "pingtasks"]);
            manifest.configuration.data.forEach((item, index) => {
              if (!isObject(item)) {
                errors.push(`configuration.data[${index}] must be an object`);
                return;
              }
              if (item.type !== "title" && item.type !== "textbox" && (typeof item.key !== "string" || !item.key.trim())) errors.push(`configuration.data[${index}].key is required`);
              if (!hasText(item.name)) errors.push(`configuration.data[${index}].name is required`);
              if (!itemTypes.has(item.type)) errors.push(`configuration.data[${index}].type is invalid`);
            });
          }
        }
        if (manifest.permissions !== void 0) {
          if (!isObject(manifest.permissions)) {
            errors.push("permissions must be an object");
          } else {
            const booleanKeys = [
              "node",
              "allowSystemRPC",
              "allowRoutes",
              "allowHooks",
              "allowHTMLInject",
              "allowExec",
              "allowListen",
              "allowAllFileAccess"
            ];
            for (const key of booleanKeys) {
              if (manifest.permissions[key] !== void 0 && typeof manifest.permissions[key] !== "boolean") {
                errors.push(`permissions.${key} must be a boolean`);
              }
            }
            for (const key of ["maxHTTPBodyBytes", "maxChildOutputBytes", "timeout"]) {
              if (manifest.permissions[key] !== void 0 && (!Number.isInteger(manifest.permissions[key]) || manifest.permissions[key] < 0)) {
                errors.push(`permissions.${key} must be a non-negative integer`);
              }
            }
          }
        }
        if (manifest.pages !== void 0) {
          if (!Array.isArray(manifest.pages)) {
            errors.push("pages must be an array");
          } else {
            manifest.pages.forEach((page, index) => {
              const prefix = `pages[${index}]`;
              if (!isObject(page)) {
                errors.push(`${prefix} must be an object`);
                return;
              }
              if (!hasText(page.title)) errors.push(`${prefix}.title is required`);
              const type = page.type || "iframe";
              const visibility = page.visibility || "admin";
              if (type !== "iframe" && type !== "redirect") errors.push(`${prefix}.type must be iframe or redirect`);
              if (visibility !== "admin" && visibility !== "public") errors.push(`${prefix}.visibility must be admin or public`);
              if (page.icon && !isLocalPath(page.icon)) errors.push(`${prefix}.icon must be a relative path`);
              if (type === "iframe" && !isLocalPath(page.file)) errors.push(`${prefix}.file must be a relative path`);
              if (type === "redirect" && !isSafeInternalPath(page.url)) errors.push(`${prefix}.url must be a safe internal path`);
            });
          }
        }
        return errors;
      }
      function isSafeInternalPath(value) {
        if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return false;
        if (value.includes("\\") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
        return !value.split("/").includes("..");
      }
      function assertValidManifest(manifest) {
        const errors = validateManifest(manifest);
        if (errors.length > 0) throw new Error(errors.join("; "));
        return manifest;
      }
      module.exports = { assertValidManifest, validateManifest };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/src/rpc.js
  var require_rpc = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/rpc.js"(exports, module) {
      "use strict";
      function createRpcClient(getServer) {
        const methods = (includeInternal = false) => getServer().call("rpc.methods", { internal: includeInternal });
        return {
          call(method, ...params) {
            return getServer().call(method, ...params);
          },
          methods,
          has(method) {
            return methods(true).then((registered) => registered.includes(method));
          },
          help(method) {
            return getServer().call("rpc.help", { method });
          }
        };
      }
      module.exports = { createRpcClient };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/schema/komari-plugin.schema.json
  var require_komari_plugin_schema = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/schema/komari-plugin.schema.json"(exports, module) {
      module.exports = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: "https://komari-monitor.github.io/plugin-sdk/komari-plugin.schema.json",
        title: "Komari Plugin Manifest",
        description: "Komari plugin manifest.",
        type: "object",
        required: ["name", "short"],
        properties: {
          $schema: { type: "string", description: "Schema URL used for editor validation." },
          name: { $ref: "#/$defs/localizedText", description: "Display name shown in Komari." },
          short: { type: "string", pattern: "^(?!default$)[A-Za-z0-9_-]+$", description: "Stable plugin identifier used in routes and RPC names." },
          description: { $ref: "#/$defs/localizedText", description: "Human-readable plugin description." },
          author: { $ref: "#/$defs/localizedText", description: "Plugin author or organization." },
          version: { type: "string", description: "Plugin version." },
          url: { type: "string", format: "uri", description: "Project or documentation URL." },
          icon: { type: "string", description: "Icon URL or plugin-relative icon path." },
          komari: { type: "string", description: "Compatible Komari version constraint, such as `>=1.4.0`." },
          entry: { type: "string", default: "script.js", description: "Compiled plugin entry file, relative to the package root." },
          permissions: { $ref: "#/$defs/permissions", description: "Runtime permissions requested by the plugin." },
          configuration: {
            type: "object",
            required: ["type", "data"],
            properties: {
              type: { const: "managed", description: "Use Komari-managed configuration storage." },
              data: { type: "array", items: { $ref: "#/$defs/configurationItem" }, description: "Configuration items shown in the admin UI." }
            },
            additionalProperties: false,
            description: "Optional configuration schema rendered by Komari."
          },
          pages: { type: "array", items: { $ref: "#/$defs/page" }, description: "Admin or public pages contributed by the plugin." }
        },
        additionalProperties: false,
        $defs: {
          localizedText: {
            description: "A string or a language-to-string map.",
            oneOf: [
              { type: "string", minLength: 1 },
              { type: "object", minProperties: 1, additionalProperties: { type: "string" } }
            ]
          },
          permissions: {
            description: "Capabilities that must be approved before enabling the plugin.",
            type: "object",
            properties: {
              node: { type: "boolean", description: "Enable Node.js-compatible modules." },
              allowSystemRPC: { type: "boolean", description: "Allow calls to system RPC methods." },
              allowRoutes: { type: "boolean", description: "Allow HTTP routes and static files." },
              allowHooks: { type: "boolean", description: "Allow request and response hooks." },
              allowHTMLInject: { type: "boolean", description: "Allow HTML head/body injection." },
              allowExec: { type: "boolean", description: "Allow child process execution." },
              allowListen: { type: "boolean", description: "Allow the plugin to listen on a local port." },
              allowAllFileAccess: { type: "boolean", description: "Allow file access outside the plugin directory." },
              maxHTTPBodyBytes: { type: "integer", minimum: 0, description: "Maximum request body size in bytes." },
              maxChildOutputBytes: { type: "integer", minimum: 0, description: "Maximum captured child process output in bytes." },
              timeout: { type: "integer", minimum: 0, description: "Plugin execution timeout in seconds." }
            },
            additionalProperties: false
          },
          page: {
            description: "A page exposed by the plugin.",
            type: "object",
            required: ["title"],
            properties: {
              file: { type: "string", description: "Page file relative to the plugin package." },
              title: { $ref: "#/$defs/localizedText", description: "Page title shown in navigation." },
              icon: { type: "string", description: "Page icon name or URL." },
              type: { enum: ["iframe", "redirect"], description: "Page presentation mode." },
              url: { type: "string", description: "Target URL for redirect pages." },
              visibility: { enum: ["admin", "public"], description: "Whether the page is visible to admins or the public." }
            },
            additionalProperties: false
          },
          configurationItem: {
            description: "One managed configuration field.",
            type: "object",
            required: ["name", "type"],
            properties: {
              key: { type: "string", minLength: 1, description: "Stable configuration key." },
              name: { $ref: "#/$defs/localizedText", description: "Label shown in the configuration UI." },
              type: { enum: ["string", "number", "select", "switch", "title", "textbox", "richtext", "nodes", "pingtasks"], description: "Editor control type." },
              options: { type: "string", description: "Options for select controls." },
              default: { description: "Default value." },
              required: { type: "boolean", description: "Whether a value is required." },
              help: { $ref: "#/$defs/localizedText", description: "Help text shown below the field." }
            },
            allOf: [
              {
                if: { properties: { type: { enum: ["title", "textbox"] } } },
                then: {},
                else: { required: ["key"] }
              }
            ],
            additionalProperties: false
          }
        }
      };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/src/rpc-catalog.json
  var require_rpc_catalog = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/rpc-catalog.json"(exports, module) {
      module.exports = {
        komari: "1.4.x",
        "rpc.methods": { params: "{ internal?: boolean }", returns: "string[]" },
        "rpc.version": { params: "none", returns: "string" },
        "rpc.ping": { params: "none", returns: "string ('pong')" },
        "rpc.help": { params: "{ method?: string }", returns: "MethodMeta | MethodMeta[]" },
        "common:getNodes": { params: "{ uuid?: string }", returns: "Client | Record<string, Client>" },
        "common:getNodesLatestStatus": { params: "{ uuid?: string, uuids?: string[] }", returns: "Record<string, unknown>" },
        "common:getMe": { params: "none", returns: "CurrentUser" },
        "common:getPublicInfo": { params: "none", returns: "PublicInfo" },
        "common:getVersion": { params: "none", returns: "{ version: string, hash: string }" },
        "common:getNodeRecentStatus": { params: "{ uuid: string }", returns: "{ count: number, records: unknown[] }" },
        "common:getRecords": { params: "RecordQuery", returns: "RecordQueryResponse" },
        "public:getMe": { params: "none", returns: "CurrentUser" },
        "public:getNodesInformation": { params: "none", returns: "Client[]" },
        "public:getPublicSettings": { params: "none", returns: "PublicInfo" },
        "public:getVersion": { params: "none", returns: "{ version: string, hash: string }" },
        "public:getClientRecentRecords": { params: "{ uuid: string }", returns: "unknown" },
        "public:getRecordsByUUID": { params: "{ uuid: string, load_type?: string, hours?: string }", returns: "{ records: unknown[], count: number }" },
        "public:getPingRecords": { params: "{ uuid?: string, task_id?: string | number }", returns: "{ records: unknown[], count: number }" },
        "public:getPublicPingTasks": { params: "none", returns: "PingTask[]" },
        "public:recordVisitorEvent": { params: "{ event: string, action?: string, path?: string, route?: string, target?: string, detail?: object }", returns: "{ status: string }" },
        "public:listMetricDefinitions": { params: "none", returns: "MetricDefinition[]" },
        "public:queryMetrics": { params: "MetricQuery", returns: "MetricSeriesResponse" },
        "public:getPingMetricStats": { params: "PingMetricStatsQuery", returns: "PingMetricStatsResponse" },
        "admin:addClient": { params: "{ name?: string }", returns: "{ uuid: string, token: string }" },
        "admin:editClient": { params: "{ uuid: string, ...fields }", returns: "null" },
        "admin:removeClient": { params: "{ uuid: string }", returns: "null" },
        "admin:getClient": { params: "{ uuid: string }", returns: "Client" },
        "admin:listClients": { params: "none", returns: "Client[]" },
        "admin:getClientToken": { params: "{ uuid: string }", returns: "{ token: string }" },
        "admin:clearRecords": { params: "none", returns: "null" },
        "admin:getTasks": { params: "none", returns: "ExecTask[]" },
        "admin:getTaskById": { params: "{ task_id: string }", returns: "ExecTask" },
        "admin:getTasksByClientId": { params: "{ uuid: string }", returns: "ExecTask[]" },
        "admin:getSpecificTaskResult": { params: "{ task_id: string, uuid: string }", returns: "TaskResult" },
        "admin:getTaskResultsByTaskId": { params: "{ task_id: string }", returns: "TaskResult[]" },
        "admin:exec": { params: "{ command: string, clients: string[] }", returns: "{ task_id: string, clients: string[], queued_clients: string[] }" },
        "admin:addPingTask": { params: "AddPingTaskParams", returns: "{ task_id: number }" },
        "admin:deletePingTask": { params: "{ id: number[] }", returns: "null" },
        "admin:editPingTask": { params: "{ tasks: PingTask[] }", returns: "null" },
        "admin:getAllPingTasks": { params: "none", returns: "PingTask[]" },
        "admin:orderPingTask": { params: "Record<string, number>", returns: "null" },
        "admin:addLoadNotification": { params: "AddLoadNotificationParams", returns: "{ task_id: number }" },
        "admin:deleteLoadNotification": { params: "{ id: number[] }", returns: "null" },
        "admin:editLoadNotification": { params: "{ notifications: LoadNotification[] }", returns: "null" },
        "admin:getAllLoadNotifications": { params: "none", returns: "LoadNotification[]" },
        "admin:listOfflineNotifications": { params: "none", returns: "OfflineNotification[]" },
        "admin:editOfflineNotification": { params: "OfflineNotification[]", returns: "null" },
        "admin:enableOfflineNotification": { params: "string[]", returns: "null" },
        "admin:disableOfflineNotification": { params: "string[]", returns: "null" },
        "admin:listTrafficReportNotifications": { params: "none", returns: "TrafficReportNotification[]" },
        "admin:editTrafficReportNotifications": { params: "TrafficReportNotification[]", returns: "null" },
        "admin:enableTrafficReportNotifications": { params: "string[]", returns: "null" },
        "admin:disableTrafficReportNotifications": { params: "string[]", returns: "null" },
        "admin:sendNotification": { params: "{ event: { event?: any, message?: any, emoji?: any, time?: string, clients?: { uuid: string }[] } }", returns: "null" },
        "admin:getSessions": { params: "none", returns: "{ current: string, data: Session[] }" },
        "admin:deleteSession": { params: "{ session: string }", returns: "null" },
        "admin:deleteAllSessions": { params: "none", returns: "null" },
        "admin:getSettings": { params: "none", returns: "object" },
        "admin:editSettings": { params: "Record<string, unknown>", returns: "null | { restart_required: true, guide_path: string }" },
        "admin:clearAllRecords": { params: "none", returns: "null" },
        "admin:orderClients": { params: "Record<string, number>", returns: "null" },
        "admin:getLogs": { params: "{ limit?: string, page?: string, msg_type?: string }", returns: "{ logs: Log[], total: number }" },
        "admin:testSendMessage": { params: "none", returns: "null" },
        "admin:testGeoip": { params: "{ ip?: string }", returns: "GeoInfo" },
        "admin:listPlugins": { params: "none", returns: "PluginStatus[]" },
        "admin:setPluginEnabled": { params: "{ short: string, enabled: boolean, approved?: boolean }", returns: "null | { requires_approval: true }" },
        "admin:getPluginLogs": { params: "{ short: string }", returns: "{ logs: string }" },
        "admin:deletePlugin": { params: "{ short: string }", returns: "null" },
        "admin:getPluginConfiguration": { params: "{ short: string }", returns: "{ configuration: object, data: object }" },
        "admin:setPluginConfiguration": { params: "{ short: string, data: object }", returns: "null" },
        "admin:getXtermjsSettings": { params: "none", returns: "XtermJSSettings" },
        "admin:setXtermjsSettings": { params: "XtermJSSettings", returns: "XtermJSSettings" },
        "admin:getMessageSenderProvider": { params: "{ provider?: string }", returns: "MessageSenderProvider | MessageSenderProvider[]" },
        "admin:setMessageSenderProvider": { params: "MessageSenderProvider", returns: "{ message: string }" },
        "admin:getOidcProvider": { params: "{ provider?: string }", returns: "OidcProvider | OidcProvider[]" },
        "admin:setOidcProvider": { params: "OidcProvider", returns: "{ message: string }" },
        "admin:getClipboard": { params: "{ id: string }", returns: "Clipboard" },
        "admin:listClipboard": { params: "none", returns: "Clipboard[]" },
        "admin:createClipboard": { params: "Clipboard", returns: "Clipboard" },
        "admin:updateClipboard": { params: "Clipboard", returns: "Clipboard" },
        "admin:deleteClipboard": { params: "{ id: string }", returns: "null" },
        "admin:batchDeleteClipboard": { params: "{ ids: string[] }", returns: "null" },
        "admin:getDatabaseSize": { params: "none", returns: "DatabaseStatus" },
        "admin:vacuumDatabase": { params: "none", returns: "DatabaseMaintenanceResponse" },
        "admin:dbQuery": { params: '{ database?: "main" | "metrics", sql: string, args?: any[], limit?: number }', returns: "DatabaseQueryResult" },
        "admin:dbExec": { params: '{ database?: "main" | "metrics", sql: string, args?: any[] }', returns: "DatabaseExecResult" },
        "admin:dbTables": { params: '{ database?: "main" | "metrics" }', returns: "DatabaseTablesResult" },
        "admin:listMetricDefinitions": { params: "none", returns: "MetricDefinition[]" },
        "admin:updateMetricDefinition": { params: "{ name: string, retention_days: number }", returns: "MetricDefinition" },
        "admin:getMetricMigrationStatus": { params: "none", returns: "MetricMigrationStatus" },
        "admin:startMetricMigration": { params: "{ source_driver?: string, source_dsn?: string }", returns: "{ status: string, message: string }" },
        "admin:cancelMetricMigration": { params: "none", returns: "{ status: string, message: string }" },
        "client:getPingTasks": { params: "none", returns: "PingTask[]" },
        "client:uploadPingResult": { params: "UploadPingResultParams", returns: "{ status: string }" },
        "client:taskResult": { params: "TaskResultParams", returns: "{ status: string, message: string }" }
      };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/src/index.js
  var require_src = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/index.js"(exports, module) {
      "use strict";
      var { assertValidManifest, validateManifest } = require_manifest();
      var { createRpcClient } = require_rpc();
      var manifestSchema = require_komari_plugin_schema();
      var rpcCatalog = require_rpc_catalog();
      var cachedServer;
      function getServer() {
        if (!cachedServer) {
          cachedServer = __require("server");
        }
        return cachedServer;
      }
      function definePlugin2(definition) {
        if (!definition || typeof definition !== "object") {
          throw new TypeError("definePlugin requires a plugin definition object");
        }
        const load = typeof definition.load === "function" ? definition.load : () => {
        };
        const unload = typeof definition.unload === "function" ? definition.unload : () => {
        };
        globalThis.load = load;
        globalThis.unload = unload;
        return definition;
      }
      function jsonResponse2(res, value, statusCode = 200) {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(value));
        return res;
      }
      function textResponse(res, value, statusCode = 200, contentType = "text/plain; charset=utf-8") {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", contentType);
        res.end(String(value));
        return res;
      }
      var exportsObject = {
        assertValidManifest,
        definePlugin: definePlugin2,
        jsonResponse: jsonResponse2,
        manifestSchema,
        rpc: createRpcClient(getServer),
        rpcCatalog,
        textResponse,
        validateManifest
      };
      Object.defineProperty(exportsObject, "server", {
        enumerable: true,
        get: getServer
      });
      module.exports = exportsObject;
    }
  });

  // src/plugin.ts
  var import_plugin_sdk = __toESM(require_src());

  // src/dnspod.ts
  var DNSPOD_HOST = "dnspod.tencentcloudapi.com";
  var DNSPOD_DEFAULT_TTL = 600;
  var DNSPodError = class extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = "DNSPodError";
    }
  };
  async function request(credentials, action, params) {
    const crypto = __require("crypto");
    const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
    const hmac = (key, value) => crypto.createHmac("sha256", key).update(value);
    const body = JSON.stringify(params);
    const timestamp = Math.floor(Date.now() / 1e3);
    const date = new Date(timestamp * 1e3).toISOString().slice(0, 10);
    const contentType = "application/json; charset=utf-8";
    const scope = `${date}/dnspod/tc3_request`;
    const signedHeaders = "content-type;host;x-tc-action";
    const canonicalHeaders = `content-type:${contentType}
host:${DNSPOD_HOST}
x-tc-action:${action.toLowerCase()}
`;
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
        Authorization: `${algorithm} Credential=${credentials.secretId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
      },
      body
    });
    const data = (await response.json())?.Response;
    if (data?.Error) {
      throw new DNSPodError(
        data.Error.Code,
        `${action}: ${data.Error.Code} ${data.Error.Message} (RequestId: ${data.RequestId})`
      );
    }
    if (!response.ok || !data) {
      throw new Error(`DNSPod ${action}: HTTP ${response.status} \u6216\u54CD\u5E94\u683C\u5F0F\u5F02\u5E38`);
    }
    return data;
  }
  function isLineId(line) {
    return /^\d+(?:=\d+)*$/.test(line);
  }
  async function listDNSPodLines(credentials, domain) {
    const { LineList } = await request(
      credentials,
      "DescribeRecordLineCategoryList",
      { Domain: domain }
    );
    if (!Array.isArray(LineList)) throw new Error("DNSPod \u7EBF\u8DEF\u5217\u8868\u54CD\u5E94\u683C\u5F0F\u5F02\u5E38");
    const lines = /* @__PURE__ */ new Map();
    function collect(items) {
      for (const { LineName: name, LineId: id, Useful, SubGroup } of items) {
        if (Useful && name) {
          const value = id === "0" ? "\u9ED8\u8BA4" : id && isLineId(id) ? id : name;
          lines.set(value, { id, name, value });
        }
        if (SubGroup) collect(SubGroup);
      }
    }
    collect(LineList);
    return Array.from(lines.values());
  }
  async function findRecords(credentials, options, lineId) {
    const records = [];
    const limit = 100;
    for (let offset = 0; ; offset += limit) {
      let page;
      try {
        page = await request(
          credentials,
          "DescribeRecordList",
          {
            Domain: options.domain,
            SubDomain: options.subdomain,
            RecordType: options.type,
            ...lineId ? { RecordLineId: options.line } : { RecordLine: options.line },
            Offset: offset,
            Limit: limit
          }
        );
      } catch (e) {
        if (e instanceof DNSPodError && e.code === "ResourceNotFound.NoDataOfRecord") break;
        throw e;
      }
      const items = page.RecordList;
      if (!Array.isArray(items)) throw new Error("DNSPod \u89E3\u6790\u8BB0\u5F55\u5217\u8868\u54CD\u5E94\u683C\u5F0F\u5F02\u5E38");
      for (const record of items) {
        if (record.Name.toLowerCase() === options.subdomain && record.Type === options.type && (lineId ? record.LineId : record.Line) === options.line) {
          records.push(record);
          if (records.length === 2) return records;
        }
      }
      if (items.length < limit) break;
    }
    return records;
  }
  async function describeRecord(credentials, domain, recordId) {
    const { RecordInfo: info } = await request(credentials, "DescribeRecord", { Domain: domain, RecordId: recordId });
    return {
      RecordId: info.Id,
      Name: info.SubDomain,
      Type: info.RecordType,
      Line: info.RecordLine,
      LineId: info.RecordLineId,
      Value: info.Value,
      Weight: info.Weight,
      TTL: info.TTL
    };
  }
  async function syncDNSPodRecord(credentials, options, ip, claimedRecords, recentlyCreatedId) {
    const { domain, subdomain, type, line, recordId, weight, ttl } = options;
    const lineId = isLineId(line);
    let record;
    if (recordId !== void 0) {
      record = await describeRecord(credentials, domain, recordId);
      if (record.RecordId !== recordId || record.Name.toLowerCase() !== subdomain || record.Type !== type) {
        throw new Error("DNSPod \u8BB0\u5F55 ID \u4E0E\u914D\u7F6E\u7684\u4E3B\u673A\u540D\u6216\u8BB0\u5F55\u7C7B\u578B\u4E0D\u5339\u914D");
      }
    } else {
      const matches = await findRecords(credentials, options, lineId);
      if (matches.length > 1) {
        throw new Error("DNSPod \u540C\u540D\u3001\u540C\u7C7B\u578B\u3001\u540C\u7EBF\u8DEF\u6709\u591A\u6761\u8BB0\u5F55\uFF0C\u8BF7\u586B\u5199 DNSPod \u8BB0\u5F55 ID");
      }
      record = matches[0];
      if (!record && recentlyCreatedId !== void 0) {
        record = await describeRecord(credentials, domain, recentlyCreatedId);
        if (record.Name.toLowerCase() !== subdomain || record.Type !== type || (lineId ? record.LineId : record.Line) !== line) {
          throw new Error("DNSPod \u521A\u521B\u5EFA\u7684\u8BB0\u5F55\u5DF2\u53D8\u66F4\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
        }
      }
    }
    if (!record) {
      const created = await request(credentials, "CreateRecord", {
        Domain: domain,
        SubDomain: subdomain,
        RecordType: type,
        RecordLine: lineId ? "\u9ED8\u8BA4" : line,
        ...lineId ? { RecordLineId: line } : {},
        Value: ip,
        TTL: ttl ?? DNSPOD_DEFAULT_TTL,
        Weight: weight
      });
      claimedRecords.add(`${domain}#${created.RecordId}`);
      return { action: "create", id: created.RecordId };
    }
    const claim = `${domain}#${record.RecordId}`;
    if (claimedRecords.has(claim)) throw new Error("\u591A\u6761 DDNS \u914D\u7F6E\u6307\u5411\u540C\u4E00\u4E2A DNSPod \u8BB0\u5F55 ID");
    claimedRecords.add(claim);
    const fields = [];
    if (record.Value !== ip) fields.push({ Key: "value", Value: ip });
    if ((lineId ? record.LineId : record.Line) !== line) {
      fields.push({ Key: lineId ? "record_line_id" : "record_line", Value: line });
    }
    if (weight !== void 0 && weight !== (record.Weight ?? 0)) {
      fields.push({ Key: "weight", Value: String(weight) });
    }
    if (ttl !== void 0 && ttl !== record.TTL) {
      fields.push({ Key: "ttl", Value: String(ttl) });
    }
    if (fields.length === 0) return { action: "skip", id: record.RecordId };
    await request(credentials, "ModifyRecordFields", {
      Domain: domain,
      RecordId: record.RecordId,
      FieldList: fields
    });
    return { action: "update", id: record.RecordId };
  }

  // src/plugin.ts
  var fs = __require("fs");
  var path = __require("path");
  var CF_API = "https://api.cloudflare.com/client/v4";
  var RECORDS_FILE = path.join(__storageDir__, "records.json");
  function storageFile() {
    return path.join(__storageDir__, "state.json");
  }
  var LOGS_FILE = path.join(__storageDir__, "logs.json");
  var MAX_LOGS = 500;
  function isValidStateEntry(v) {
    return v && typeof v.record_name === "string" && v.record_name && (v.record_type === "A" || v.record_type === "AAAA");
  }
  function cleanState(state) {
    const cleaned = {};
    for (const key of Object.keys(state || {})) {
      if (isValidStateEntry(state[key])) {
        cleaned[key] = state[key];
      }
    }
    return cleaned;
  }
  function loadState() {
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
  function saveState(state) {
    try {
      fs.writeFileSync(storageFile(), JSON.stringify(cleanState(state), null, 2));
    } catch (e) {
      console.error("[cf-ddns] save state failed:", e);
    }
  }
  function loadRecords() {
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
  function saveRecords(arr) {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(arr, null, 2));
  }
  var TOKEN_SET = "***SET***";
  function publicRecord(r) {
    const out = { ...r };
    if (r.api_token) {
      out.api_token = TOKEN_SET;
    } else {
      delete out.api_token;
    }
    return out;
  }
  function getRecords(config) {
    const stored = loadRecords();
    if (stored.length > 0) return stored;
    const seeded = parseRecords(config);
    if (Array.isArray(seeded) && seeded.length > 0) {
      saveRecords(seeded);
      return seeded;
    }
    return stored;
  }
  function recordKey(rec) {
    if (rec.provider !== "dnspod") return `${rec.record_name}#${rec.record_type}`;
    const target = rec.record_id ? `id:${rec.record_id}` : `line:${rec.record_line || "\u9ED8\u8BA4"}`;
    return `dnspod:${rec.domain}#${rec.record_name}#${rec.record_type}#${target}`;
  }
  function normalizeDNSName(value) {
    return String(value ?? "").trim().toLowerCase().replace(/\.$/, "");
  }
  function dnsPodCredentials(config) {
    const secretId = String(config.tencent_secret_id ?? "").trim();
    const secretKey = String(config.tencent_secret_key ?? "").trim();
    if (!secretId || !secretKey) throw new Error("\u8BF7\u5728\u63D2\u4EF6\u914D\u7F6E\u4E2D\u586B\u5199\u817E\u8BAF\u4E91 SecretId \u548C SecretKey");
    return { secretId, secretKey };
  }
  function configuredDNSPodTTL(rec) {
    return rec.ttl_seconds !== void 0 ? rec.ttl_seconds : rec.ttl === 1 ? void 0 : rec.ttl;
  }
  function normalizeDNSPodRecord(rec) {
    const domain = normalizeDNSName(rec.domain);
    const name = normalizeDNSName(rec.record_name);
    if (!domain.includes(".") || name !== domain && !name.endsWith("." + domain)) {
      throw new Error("\u89E3\u6790\u57DF\u540D\u5FC5\u987B\u662F\u8BB0\u5F55\u540D\u79F0\u672C\u8EAB\u6216\u5176\u4E0A\u7EA7\u57DF\u540D");
    }
    if (rec.weight !== void 0 && (!Number.isInteger(rec.weight) || rec.weight < 0 || rec.weight > 100)) {
      throw new Error("\u6743\u91CD\u5FC5\u987B\u662F 0 \u5230 100 \u7684\u6574\u6570\uFF0C\u6216\u7559\u7A7A");
    }
    if (rec.record_id !== void 0 && (!Number.isSafeInteger(rec.record_id) || rec.record_id < 1)) {
      throw new Error("DNSPod \u8BB0\u5F55 ID \u5FC5\u987B\u662F\u6B63\u6574\u6570\uFF0C\u6216\u7559\u7A7A");
    }
    const ttl = configuredDNSPodTTL(rec);
    if (ttl !== void 0 && (!Number.isInteger(ttl) || ttl < 1 || ttl > 604800)) {
      throw new Error("DNSPod TTL \u5FC5\u987B\u4E3A 1 \u5230 604800 \u79D2\u7684\u6574\u6570");
    }
    const line = String(rec.record_line ?? "").trim();
    return { ...rec, domain, record_name: name, record_line: !line || line === "0" ? "\u9ED8\u8BA4" : line, ttl: void 0, ttl_seconds: ttl };
  }
  function parseRecords(config) {
    const raw = config.records;
    if (typeof raw !== "string" || !raw.trim()) {
      return { error: "records \u914D\u7F6E\u4E3A\u7A7A" };
    }
    let arr;
    try {
      arr = JSON.parse(raw);
    } catch (e) {
      return { error: "records \u4E0D\u662F\u5408\u6CD5 JSON\uFF1A" + e.message };
    }
    if (!Array.isArray(arr)) {
      return { error: "records \u5FC5\u987B\u662F\u4E00\u4E2A JSON \u6570\u7EC4" };
    }
    return arr.map((r) => ({
      zone_id: String(r.zone_id || ""),
      record_name: String(r.record_name || ""),
      record_type: r.record_type === "AAAA" ? "AAAA" : "A",
      source_node: Array.isArray(r.source_node) ? r.source_node.map((x) => String(x)) : [],
      ttl: Number(r.ttl) || 1,
      proxied: !!r.proxied,
      comment: r.comment ? String(r.comment) : void 0,
      api_token: r.api_token ? String(r.api_token) : void 0
    }));
  }
  async function resolveTargetIp(ctx, sourceNode, recordType) {
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
  async function cloudflareList(token, zone, name, type) {
    const url = `${CF_API}/zones/${zone}/dns_records?name=${encodeURIComponent(
      name
    )}&type=${type}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await resp.json();
    if (!data.success) {
      throw new Error("Cloudflare list failed: " + JSON.stringify(data.errors));
    }
    return data.result && data.result.length ? data.result[0] : null;
  }
  async function cloudflareCreate(token, zone, payload) {
    const url = `${CF_API}/zones/${zone}/dns_records`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!data.success) {
      throw new Error("Cloudflare create failed: " + JSON.stringify(data.errors));
    }
    return data.result;
  }
  async function cloudflareUpdate(token, zone, id, payload) {
    const url = `${CF_API}/zones/${zone}/dns_records/${id}`;
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!data.success) {
      throw new Error("Cloudflare update failed: " + JSON.stringify(data.errors));
    }
    return data.result;
  }
  var zoneCache = {};
  async function cloudflareListZones(token) {
    const zones = [];
    let page = 1;
    while (true) {
      const url = `${CF_API}/zones?per_page=100&page=${page}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (!data.success) {
        throw new Error(
          "Cloudflare list zones failed: " + JSON.stringify(data.errors)
        );
      }
      zones.push(...data.result || []);
      const info = data.result_info;
      if (!info || page >= info.total_pages) break;
      page++;
    }
    return zones;
  }
  async function getZones(token) {
    const cached = zoneCache[token];
    if (cached && Date.now() - cached.at < 5 * 60 * 1e3) return cached.zones;
    const zones = await cloudflareListZones(token);
    zoneCache[token] = { zones, at: Date.now() };
    return zones;
  }
  function zoneForRecord(zones, recordName) {
    let best = null;
    for (const z of zones || []) {
      const name = z.name;
      if (recordName === name || recordName.endsWith("." + name)) {
        if (!best || name.length > best.name.length) best = z;
      }
    }
    return best;
  }
  function appendLog(entry) {
    try {
      let arr = [];
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
  function logSync(rec, action, success, detail, ip) {
    appendLog({
      time: (/* @__PURE__ */ new Date()).toISOString(),
      record_name: rec.record_name,
      record_type: rec.record_type,
      provider: rec.provider,
      record_line: rec.record_line,
      record_id: rec.record_id,
      action,
      success,
      detail,
      ip
    });
  }
  async function syncRecord(config, rec, ctx) {
    const key = recordKey(rec);
    const result = {
      key,
      record_name: rec.record_name,
      record_type: rec.record_type,
      zone_id: rec.zone_id
    };
    try {
      if (!rec.record_name || !rec.source_node?.length) {
        throw new Error("\u914D\u7F6E\u4E0D\u5B8C\u6574\uFF08\u7F3A\u5C11\u8BB0\u5F55\u540D\u79F0\u6216\u6765\u6E90\u8282\u70B9\uFF09");
      }
      const target = await resolveTargetIp(ctx, rec.source_node, rec.record_type);
      if (!target) {
        result.skipped = "no valid node IP";
        logSync(rec, "skip", true, "\u65E0\u53EF\u7528\u8282\u70B9\u516C\u7F51 IP");
        return result;
      }
      const previous = loadState()[key] || {};
      let createdId;
      let action;
      let skipDetail;
      if (rec.provider === "dnspod") {
        const dns = normalizeDNSPodRecord(rec);
        const domain = dns.domain;
        const synced = await syncDNSPodRecord(
          dnsPodCredentials(config),
          {
            domain,
            subdomain: dns.record_name === domain ? "@" : dns.record_name.slice(0, -(domain.length + 1)),
            type: dns.record_type,
            line: dns.record_line,
            recordId: dns.record_id,
            weight: dns.weight,
            ttl: dns.ttl_seconds
          },
          target.ip,
          ctx.claimedDNSPodRecords,
          Date.now() - previous.dnspod_created_at < 3e4 ? previous.dnspod_created_id : void 0
        );
        action = synced.action;
        if (action === "create") createdId = synced.id;
        skipDetail = "DNSPod \u89E3\u6790\u8BB0\u5F55\u5DF2\u7B26\u5408\u914D\u7F6E";
      } else {
        const token = rec.api_token || config.api_token;
        if (!token) throw new Error("\u8BF7\u914D\u7F6E Cloudflare API Token");
        action = await syncCloudflareRecord(token, rec, target.ip);
        skipDetail = "IP \u4E0E\u4EE3\u7406\u72B6\u6001\u5747\u65E0\u53D8\u5316";
      }
      result.current_ip = target.ip;
      if (action === "skip") {
        result.updated = false;
        result.skipped = "no change";
        logSync(rec, "skip", true, skipDetail);
      } else {
        const verb = action === "create" ? "\u521B\u5EFA" : "\u66F4\u65B0";
        result[action === "create" ? "created" : "updated"] = true;
        logSync(rec, action, true, `${verb} DNS \u8BB0\u5F55 \u2192 ${target.ip}`, target.ip);
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const state = loadState();
      state[key] = {
        record_name: rec.record_name,
        record_type: rec.record_type,
        last_ip: target.ip,
        last_node: target.name,
        last_checked_at: now,
        last_update_at: action === "skip" ? previous.last_update_at : now,
        dnspod_created_id: createdId ?? previous.dnspod_created_id,
        dnspod_created_at: createdId === void 0 ? previous.dnspod_created_at : Date.now()
      };
      saveState(state);
      if (action !== "skip" && config.notify) {
        await sendNotify(config, rec, target, action === "create" ? "\u521B\u5EFA" : "\u66F4\u65B0");
      }
    } catch (e) {
      result.error = String(e);
      logSync(rec, "error", false, result.error);
    }
    return result;
  }
  async function syncCloudflareRecord(token, rec, ip) {
    let zoneId = rec.zone_id;
    if (!zoneId) {
      const zone = zoneForRecord(await getZones(token), rec.record_name);
      if (!zone) {
        throw new Error(`\u65E0\u6CD5\u81EA\u52A8\u89E3\u6790 Zone ID\uFF08\u8BB0\u5F55\u540D ${rec.record_name} \u5728 Cloudflare \u8D26\u53F7\u4E0B\u627E\u4E0D\u5230\u5BF9\u5E94\u57DF\u540D\uFF0C\u53EF\u5728\u8BB0\u5F55\u4E2D\u624B\u52A8\u586B\u5199 zone_id \u8986\u76D6\uFF09`);
      }
      zoneId = zone.id;
    }
    const record = await cloudflareList(token, zoneId, rec.record_name, rec.record_type);
    const payload = {
      type: rec.record_type,
      name: rec.record_name,
      content: ip,
      ttl: rec.ttl || 1,
      proxied: !!rec.proxied
    };
    if (!record) {
      await cloudflareCreate(token, zoneId, payload);
      return "create";
    }
    if (record.content === ip && record.proxied === payload.proxied) return "skip";
    await cloudflareUpdate(token, zoneId, record.id, payload);
    return "update";
  }
  async function sendNotify(config, rec, target, verb) {
    if (!config.notify) return;
    try {
      await import_plugin_sdk.server.call("admin:sendNotification", {
        event: {
          event: "DDNS",
          emoji: "\u{1F310}",
          message: `DDNS ${verb}\uFF1A${rec.record_name}${rec.provider === "dnspod" ? ` [${rec.record_line || "\u9ED8\u8BA4"}]` : ""} \u2192 ${target.ip}\uFF08\u8282\u70B9 ${target.name}\uFF09`,
          time: (/* @__PURE__ */ new Date()).toISOString(),
          clients: [{ uuid: target.uuid }]
        }
      });
    } catch (e) {
      console.warn("[cf-ddns] notify failed:", e);
    }
  }
  var activeSync;
  function syncOnce() {
    if (!activeSync) {
      activeSync = syncAllRecords().finally(() => {
        activeSync = void 0;
      });
    }
    return activeSync;
  }
  async function syncAllRecords() {
    const config = await import_plugin_sdk.server.getConfig();
    const list = getRecords(config);
    if (list.length === 0) {
      return { ok: false, error: "\u5C1A\u672A\u914D\u7F6E\u4EFB\u4F55 DDNS \u8BB0\u5F55", records: [] };
    }
    const uuids = /* @__PURE__ */ new Set();
    for (const r of list) {
      const sn = r.source_node && r.source_node.length ? r.source_node : [];
      for (const u of sn) uuids.add(u);
    }
    const nodes = await import_plugin_sdk.server.call("common:getNodes");
    let statuses = {};
    try {
      statuses = await import_plugin_sdk.server.call("common:getNodesLatestStatus", {
        uuids: Array.from(uuids)
      });
    } catch (e) {
      console.warn(
        "[cf-ddns] getNodesLatestStatus failed, continuing without online check:",
        e
      );
    }
    const ctx = { nodes, statuses, claimedDNSPodRecords: /* @__PURE__ */ new Set() };
    const results = [];
    for (const r of list) {
      try {
        results.push(await syncRecord(config, r, ctx));
      } catch (e) {
        results.push({
          key: recordKey(r),
          record_name: r.record_name,
          record_type: r.record_type,
          error: String(e)
        });
      }
    }
    const errors = results.filter((r) => r.error).length;
    const skipped = results.filter((r) => !r.error && r.skipped).length;
    const changed = results.length - errors - skipped;
    const logParts = ["\u5171 " + results.length + " \u6761"];
    if (changed > 0) logParts.push("\u66F4\u65B0/\u521B\u5EFA " + changed + " \u6761");
    if (skipped > 0) logParts.push("\u8DF3\u8FC7 " + skipped + " \u6761");
    if (errors > 0) logParts.push("\u5931\u8D25 " + errors + " \u6761");
    logSync({}, "sync", errors === 0, "\u540C\u6B65\u5B8C\u6210\uFF1A" + logParts.join("\uFF0C"));
    return {
      ok: errors === 0,
      total: results.length,
      errors,
      skipped,
      records: results
    };
  }
  function cronExpression(minutes) {
    const m = Math.max(1, Math.min(59, Math.floor(minutes || 5)));
    return `*/${m} * * * *`;
  }
  function isAdmin(req) {
    const principal = req && req.context && req.context.principal;
    if (!principal) return false;
    const roles = principal.roles || [];
    return principal.type === "user" && roles.indexOf("admin") >= 0;
  }
  function parseQuery(req) {
    const q = {};
    const u = req && req.url || "";
    const idx = u.indexOf("?");
    if (idx < 0) return q;
    u.slice(idx + 1).split("&").forEach((pair) => {
      if (!pair) return;
      const i = pair.indexOf("=");
      const k = i < 0 ? pair : pair.slice(0, i);
      const v = i < 0 ? "" : pair.slice(i + 1);
      try {
        q[decodeURIComponent(k)] = decodeURIComponent(v);
      } catch {
      }
    });
    return q;
  }
  function loadLogs() {
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
  (0, import_plugin_sdk.definePlugin)({
    load() {
      import_plugin_sdk.server.getConfig().then((cfg) => {
        const interval = cfg && cfg.interval || 5;
        import_plugin_sdk.server.cron(cronExpression(interval), () => {
          syncOnce().catch((e) => console.error("[cf-ddns] cron error:", e));
        });
        console.log(`[cf-ddns] scheduled sync every ${interval} minute(s)`);
      }).catch((e) => console.error("[cf-ddns] getConfig error:", e));
      import_plugin_sdk.server.route("GET", "/cf-ddns/status", (req, res) => {
        if (!isAdmin(req)) {
          res.statusCode = 401;
          res.end("unauthorized");
          return;
        }
        (0, import_plugin_sdk.jsonResponse)(res, loadState());
      });
      import_plugin_sdk.server.route("POST", "/cf-ddns/sync", async (req, res) => {
        if (!isAdmin(req)) {
          res.statusCode = 401;
          res.end("unauthorized");
          return;
        }
        const r = await syncOnce();
        (0, import_plugin_sdk.jsonResponse)(res, r);
      });
      import_plugin_sdk.server.route("GET", "/cf-ddns/nodes", async (req, res) => {
        if (!isAdmin(req)) {
          res.statusCode = 401;
          res.end("unauthorized");
          return;
        }
        try {
          const nodes = await import_plugin_sdk.server.call("common:getNodes");
          const list = Object.keys(nodes).map((u) => ({
            uuid: u,
            name: nodes[u] && nodes[u].name ? nodes[u].name : u
          }));
          (0, import_plugin_sdk.jsonResponse)(res, list);
        } catch (e) {
          (0, import_plugin_sdk.jsonResponse)(res, { error: String(e) }, 500);
        }
      });
      import_plugin_sdk.server.route("GET", "/cf-ddns/dnspod-lines", async (req, res) => {
        if (!isAdmin(req)) {
          (0, import_plugin_sdk.jsonResponse)(res, { error: "\u8BF7\u4EE5\u7BA1\u7406\u5458\u8EAB\u4EFD\u767B\u5F55" }, 401);
          return;
        }
        const domain = normalizeDNSName(parseQuery(req).domain);
        if (domain.length > 253 || !/^[^\s./:@?#\\]+(?:\.[^\s./:@?#\\]+)+$/.test(domain)) {
          (0, import_plugin_sdk.jsonResponse)(res, { error: "\u8BF7\u8F93\u5165\u5B8C\u6574\u7684 DNSPod \u89E3\u6790\u57DF\u540D" }, 400);
          return;
        }
        try {
          const config = await import_plugin_sdk.server.getConfig();
          const lines = await listDNSPodLines(dnsPodCredentials(config), domain);
          (0, import_plugin_sdk.jsonResponse)(res, { lines });
        } catch (e) {
          (0, import_plugin_sdk.jsonResponse)(res, { error: e instanceof Error ? e.message : String(e) }, 502);
        }
      });
      import_plugin_sdk.server.route("GET", "/cf-ddns/records", async (req, res) => {
        if (!isAdmin(req)) {
          res.statusCode = 401;
          res.end("unauthorized");
          return;
        }
        const config = await import_plugin_sdk.server.getConfig();
        (0, import_plugin_sdk.jsonResponse)(res, getRecords(config).map(publicRecord));
      });
      import_plugin_sdk.server.route("PUT", "/cf-ddns/records", async (req, res) => {
        if (!isAdmin(req)) {
          res.statusCode = 401;
          res.end("unauthorized");
          return;
        }
        let arr;
        try {
          arr = JSON.parse(req.body || "null");
        } catch (e) {
          (0, import_plugin_sdk.jsonResponse)(res, { error: "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON" }, 400);
          return;
        }
        if (!Array.isArray(arr)) {
          (0, import_plugin_sdk.jsonResponse)(res, { error: "\u8BB0\u5F55\u5FC5\u987B\u662F JSON \u6570\u7EC4" }, 400);
          return;
        }
        const oldRecs = loadRecords();
        const oldMap = /* @__PURE__ */ new Map();
        oldRecs.forEach(
          (r) => oldMap.set(recordKey(r), r)
        );
        const clean = [];
        const dnsPodKeys = /* @__PURE__ */ new Set();
        for (let i = 0; i < arr.length; i++) {
          const r = arr[i] || {};
          const name = String(r.record_name || "").trim();
          try {
            if (!name.includes(".")) throw new Error("\u8BB0\u5F55\u540D\u79F0\u5E94\u4E3A\u5B8C\u6574\u57DF\u540D\uFF08FQDN\uFF09");
            if (r.provider && r.provider !== "cloudflare" && r.provider !== "dnspod") {
              throw new Error("\u672A\u77E5\u7684 DNS \u63D0\u4F9B\u5546");
            }
            const rec = {
              record_name: name,
              record_type: r.record_type === "AAAA" ? "AAAA" : "A",
              source_node: Array.isArray(r.source_node) ? r.source_node.map(String) : [],
              ttl: Number(r.ttl) || 1,
              proxied: !!r.proxied,
              comment: r.comment ? String(r.comment) : void 0
            };
            if (r.provider === "dnspod") {
              const dns = normalizeDNSPodRecord({
                ...rec,
                provider: "dnspod",
                domain: r.domain,
                record_line: r.record_line,
                record_line_name: typeof r.record_line_name === "string" ? r.record_line_name : void 0,
                record_id: r.record_id,
                weight: r.weight,
                proxied: false,
                ttl: r.ttl,
                ttl_seconds: r.ttl_seconds
              });
              const key = recordKey(dns);
              if (dnsPodKeys.has(key)) throw new Error("DNSPod \u8BB0\u5F55\u914D\u7F6E\u91CD\u590D");
              if (dns.ttl_seconds === void 0) {
                const old = oldMap.get(key);
                dns.ttl_seconds = old ? configuredDNSPodTTL(old) : DNSPOD_DEFAULT_TTL;
              }
              dnsPodKeys.add(key);
              clean.push(dns);
            } else {
              rec.zone_id = String(r.zone_id || "");
              rec.api_token = r.api_token && r.api_token !== TOKEN_SET ? String(r.api_token) : oldMap.get(recordKey(rec))?.api_token;
              clean.push(rec);
            }
          } catch (e) {
            (0, import_plugin_sdk.jsonResponse)(res, { error: `\u7B2C ${i + 1} \u6761\u8BB0\u5F55\uFF1A${e.message}` }, 400);
            return;
          }
        }
        const oldKeys = new Set(oldMap.keys());
        const newKeys = new Set(
          clean.map((r) => recordKey(r))
        );
        let added = 0;
        let removed = 0;
        let edited = 0;
        const changedFields = (a, b) => {
          const out = [];
          const cmp = (k, label) => {
            if (String(a[k] ?? "") !== String(b[k] ?? "")) out.push(label);
          };
          cmp("zone_id", "Zone");
          cmp("record_line", "\u7EBF\u8DEF");
          cmp("weight", "\u6743\u91CD");
          cmp("record_name", "\u540D\u79F0");
          cmp("record_type", "\u7C7B\u578B");
          if (b.provider === "dnspod") {
            if (configuredDNSPodTTL(a) !== configuredDNSPodTTL(b)) out.push("TTL");
          } else {
            cmp("ttl", "TTL");
          }
          cmp("proxied", "\u4EE3\u7406");
          cmp("comment", "\u5907\u6CE8");
          const sa = (a.source_node || []).join(",");
          const sb = (b.source_node || []).join(",");
          if (sa !== sb) out.push("\u6765\u6E90\u8282\u70B9");
          if (!!a.api_token !== !!b.api_token) out.push("Token");
          return out;
        };
        clean.forEach((r) => {
          const key = recordKey(r);
          const old = oldMap.get(key);
          if (!old) {
            added++;
            logSync(r, "add", true, `\u65B0\u589E\u8BB0\u5F55 ${r.record_name} (${r.record_type})`);
          } else {
            const fields = changedFields(old, r);
            if (fields.length) {
              edited++;
              logSync(
                r,
                "edit",
                true,
                `\u4FEE\u6539\u8BB0\u5F55 ${r.record_name} (${r.record_type})\uFF1A${fields.join("\u3001")}`
              );
            }
          }
        });
        oldRecs.forEach((r) => {
          if (!newKeys.has(recordKey(r))) {
            removed++;
            logSync(r, "delete", true, `\u5220\u9664\u8BB0\u5F55 ${r.record_name} (${r.record_type})`);
          }
        });
        saveRecords(clean);
        (0, import_plugin_sdk.jsonResponse)(res, { ok: true, total: clean.length, added, removed, edited });
      });
      import_plugin_sdk.server.route("GET", "/cf-ddns/logs", (req, res) => {
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
        const n = isNaN(limit) || limit <= 0 ? 100 : Math.min(limit, 1e3);
        const out = logs.slice(-n).reverse();
        (0, import_plugin_sdk.jsonResponse)(res, { total: logs.length, logs: out });
      });
      import_plugin_sdk.server.route("DELETE", "/cf-ddns/logs", (req, res) => {
        if (!isAdmin(req)) {
          res.statusCode = 401;
          res.end("unauthorized");
          return;
        }
        try {
          if (fs.existsSync(LOGS_FILE)) fs.unlinkSync(LOGS_FILE);
        } catch (e) {
          (0, import_plugin_sdk.jsonResponse)(res, { ok: false, error: String(e) }, 500);
          return;
        }
        (0, import_plugin_sdk.jsonResponse)(res, { ok: true });
      });
    }
  });
})();
