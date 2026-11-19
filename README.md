# Komari DDNS 插件

> ⚠️ **免责声明**：本项目由 AI 辅助完成，按「现状」提供，**风险自负**。作者不对因使用本插件造成的任何问题（包括但不限于 DNS 配置错误、解析异常、服务中断、数据泄露等）承担任何责任。请在充分理解代码的前提下于测试环境中自行验证后再用于生产环境。

根据 Komari **节点上报的公网 IP**，自动更新 Cloudflare 和腾讯云中国站 DNSPod 解析记录，实现动态域名解析（DDNS）。

## 工作原理

1. 按设定间隔（`interval`，默认 5 分钟）触发一次同步；
2. 读取来源节点上报的公网 IP，A 记录使用 IPv4，AAAA 记录使用 IPv6。
3. 按记录选择 Cloudflare 或 DNSPod，查询并创建缺少的记录，或更新与配置不符的记录。
4. 每条记录的状态独立保存到插件长期存储目录（`__storageDir__`），创建或更新时可发送通知。

## 配置项

| 配置 | 说明 |
| --- | --- |
| `api_token` | Cloudflare 记录共用的 API Token（需 `Zone:DNS:Edit` 权限） |
| `tencent_secret_id` | DNSPod 记录共用的腾讯云中国站 API 密钥 SecretId |
| `tencent_secret_key` | DNSPod 记录共用的腾讯云中国站 API 密钥 SecretKey |
| `interval` | 检查间隔（分钟，默认 5） |
| `notify` | 更新/创建时是否发送 Komari 通知 |

> **DDNS 记录不在插件配置里填写**，而是在管理页面通过表单可视化增删改（数据保存在插件长期存储目录 `records.json`）。这样无需手写 JSON。

`records` 数组中每项的字段（仅在需要直接编辑存储文件 `records.json` 时参考；日常通过管理页面表单操作）：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `provider` | 否 | `dnspod` 使用腾讯云中国站 DNSPod，省略时使用 Cloudflare |
| `domain` | DNSPod 必填 | DNSPod 控制台中的解析域名，如 `example.com` |
| `record_line` | 否 | DNSPod 线路名称（如 `电信`）或线路 ID（如 `10=0`），默认 `默认` |
| `record_line_name` | 否 | 线路的显示名称，由管理页保存 |
| `weight` | 否 | DNSPod 权重，整数 `1`–`100`，`0` 关闭，省略时保留已有记录的权重 |
| `record_id` | 否 | 指定已有 DNSPod 记录。同名、同类型、同线路有多条记录时，填写对应的记录 ID |
| `zone_id` | 否 | 域名所在的 Zone ID；**留空时由插件通过 Cloudflare API 按记录名自动匹配**（推荐留空） |
| `record_name` | 是 | 记录名称（FQDN，如 `home.example.com`） |
| `record_type` | 否 | `A` 或 `AAAA`，默认 `A` |
| `source_node` | 否 | 节点 UUID；记录所用的来源节点（单节点） |
| `ttl` | 否 | Cloudflare TTL 秒数，`1` 表示自动 |
| `ttl_seconds` | DNSPod 新记录 | DNSPod TTL 秒数，输入 1–604800 的整数，新记录默认 600 秒。实际最低值由域名套餐决定 |
| `proxied` | 否 | 是否启用 Cloudflare 代理（橙色云），默认 `false` |
| `comment` | 否 | 备注，仅在管理页展示，不参与同步 |
| `api_token` | 否 | 可选；填写则覆盖该记录全局 `api_token`（仅建议通过直接编辑 `records.json` 设置，管理页表单不暴露此字段，前端读取时一律脱敏） |

## 腾讯云 DNSPod 配置

1. 在插件配置中填写腾讯云中国站 API 密钥的 **SecretId** 和 **SecretKey**。密钥需要有目标域名的 `DescribeRecordLineCategoryList`、`DescribeRecordList`、`CreateRecord`、`ModifyRecordFields` 权限。填写记录 ID 时，或创建后等待 DNSPod 索引期间，还会调用 `DescribeRecord`。
2. 在「DDNS 状态」添加记录，将提供商设为「腾讯云 DNSPod（中国站）」，填写解析域名、完整记录名称和来源节点。例如，解析域名填 `example.com`，记录名称填 `home.example.com`。根域名记录的两个字段均填 `example.com`。
3. 填写解析域名后，线路下拉框会自动加载该域名当前可用的线路。选择线路，填写 TTL 秒数，按需填写权重，然后保存并点击「立即同步全部」。免费版最低 TTL 为 600 秒，专业版为 60 秒，企业版和尊享版为 1 秒。 [DNSPod 线路查询](https://cloud.tencent.com/document/product/1427/104320) · [腾讯云 TTL 说明](https://cloud.tencent.com/document/product/302/9072)

升级后，旧 DNSPod 配置中的固定 TTL 会继续生效。旧选项为「自动」时，已有云端记录保留其 TTL，创建缺失记录时使用 600 秒。编辑这类配置时可录入明确的 TTL。配置了具体秒数后，即使 IP 没有变化，也会同步 TTL。

同一名称和类型可以按不同线路配置。留空记录 ID 时，插件在选定线路查找或创建记录。要移动已有记录的线路，编辑时同时填写该记录的 DNSPod 记录 ID。管理页的删除操作会停止同步，对应的云端记录仍可在 DNSPod 控制台管理。

## 开发

```sh
npm install
# 编辑 komari.local.json，填入开发服务器地址与 API Key
npm run dev        # 编译、上传、启用并热重载
npm run typecheck  # 仅类型检查
npm run build      # 编译
npm run pack       # 打包为 ZIP
```

## 手动安装

```sh
npm run pack
```

在 Komari 管理后台「插件」页面上传生成的 ZIP，启用并批准所需权限（`allowSystemRPC`、`allowRoutes`）。

## 权限说明

- `node`：使用 `fs` 持久化状态到长期存储目录，使用 `crypto` 为 DNSPod API 请求签名；
- `allowSystemRPC`：调用 `common:getNodes` / `common:getNodesLatestStatus` / `admin:sendNotification`；
- `allowRoutes`：注册状态与手动同步路由（仅管理员可访问）。
- `maxHTTPBodyBytes` 为 4 MiB，用于容纳 DNSPod 返回的完整线路列表。

## 管理页面

启用后在管理后台侧边栏「插件」分组下打开「DDNS 状态」页面。

- **外观**默认跟随系统，可在页首切换亮色或暗色。手动选择会保存在当前浏览器。
- **列表字段**包括 DNS 提供商、记录名称、类型、来源节点、线路与权重或 Cloudflare 代理状态、TTL、上次同步的 IP 和备注。
- **编辑面板**根据所选 DNS 提供商显示对应配置项。
- **添加 / 删除**：支持添加新记录或在编辑面板删除已有记录。
- **立即同步全部**：手动触发一次全量同步。
- **日志查询**：切换到「日志」标签查看每次同步的操作历史，包含时间、记录名、类型、操作（创建/更新/跳过/错误，彩色标签）与详情；支持按记录名筛选、限制条数（默认 100、最多 1000）、刷新与清空。

> 旧的 `records` 配置（JSON 文本框）在首次加载时会被自动迁移到存储文件，之后以管理页面维护的内容为准。
