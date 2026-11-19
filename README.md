# Komari DDNS 插件

> ⚠️ **免责声明**：本项目由 AI 辅助完成，按「现状」提供，**风险自负**。作者不对因使用本插件造成的任何问题（包括但不限于 DNS 配置错误、解析异常、服务中断、数据泄露等）承担任何责任。请在充分理解代码的前提下于测试环境中自行验证后再用于生产环境。

根据 Komari **节点上报的公网 IP**，自动更新 Cloudflare、腾讯云中国站 DNSPod 和华为云中国站 DNS 解析记录，实现动态域名解析（DDNS）。

## 工作原理

1. 按设定间隔（`interval`，默认 5 分钟）触发一次同步；
2. 读取来源节点上报的公网 IP，A 记录使用 IPv4，AAAA 记录使用 IPv6。
3. 按记录选择 DNS 提供商，查询并创建缺少的记录，或更新与配置不符的记录。
4. 每条记录的状态独立保存到插件长期存储目录（`__storageDir__`），创建或更新时可发送通知。

## 配置项

| 配置 | 说明 |
| --- | --- |
| `api_token` | Cloudflare 记录共用的 API Token（需 `Zone:DNS:Edit` 权限） |
| `tencent_secret_id` | DNSPod 记录共用的腾讯云中国站 API 密钥 SecretId |
| `tencent_secret_key` | DNSPod 记录共用的腾讯云中国站 API 密钥 SecretKey |
| `huawei_access_key` | 华为云中国站 DNS 记录共用的永久访问密钥 AK |
| `huawei_secret_key` | 华为云中国站 DNS 记录共用的永久访问密钥 SK |
| `interval` | 检查间隔（分钟，默认 5） |
| `notify` | 更新/创建时是否发送 Komari 通知 |

> **DDNS 记录不在插件配置里填写**，而是在管理页面通过表单可视化增删改（数据保存在插件长期存储目录 `records.json`）。这样无需手写 JSON。

`records` 数组中每项的字段（仅在需要直接编辑存储文件 `records.json` 时参考；日常通过管理页面表单操作）：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `provider` | 否 | `dnspod` 使用腾讯云中国站，`huaweicloud` 使用华为云中国站，省略时使用 Cloudflare |
| `domain` | DNSPod、华为云必填 | 提供商控制台中的公网解析域名，如 `example.com` |
| `record_line` | 否 | DNSPod 支持线路名称或 ID，默认 `默认`。华为云使用线路 ID（如 `Dianxin_Tianjin`），默认 `default_view` |
| `record_line_name` | 否 | 线路的显示名称，由管理页保存 |
| `weight` | 否 | DNSPod 支持整数 `0`–`100`，`0` 关闭。华为云支持整数 `0`–`1000`，`0` 表示备用。省略时保留已有记录的权重 |
| `record_id` | 否 | 指定已有 DNSPod 记录。同名、同类型、同线路有多条记录时，填写对应的记录 ID |
| `recordset_id` | 否 | 指定已有华为云记录集。同名、同类型、同线路有多个记录集时，填写对应的记录集 ID |
| `zone_id` | 否 | 域名所在的 Zone ID；**留空时由插件通过 Cloudflare API 按记录名自动匹配**（推荐留空） |
| `record_name` | 是 | 记录名称（FQDN，如 `home.example.com`） |
| `record_type` | 否 | `A` 或 `AAAA`，默认 `A` |
| `source_node` | 否 | 节点 UUID；记录所用的来源节点（单节点） |
| `ttl` | 否 | Cloudflare TTL 秒数，`1` 表示自动 |
| `ttl_seconds` | DNSPod、华为云新记录 | 固定 TTL（秒）。DNSPod 默认 600，范围 1–604800，最低值受套餐限制。华为云默认 300，范围 1–2147483647 |
| `proxied` | 否 | 是否启用 Cloudflare 代理（橙色云），默认 `false` |
| `comment` | 否 | 备注，仅在管理页展示，不参与同步 |
| `api_token` | 否 | 可选；填写则覆盖该记录全局 `api_token`（仅建议通过直接编辑 `records.json` 设置，管理页表单不暴露此字段，前端读取时一律脱敏） |

## 腾讯云 DNSPod 配置

1. 在插件配置中填写腾讯云中国站 API 密钥的 **SecretId** 和 **SecretKey**。密钥需要有目标域名的 `DescribeRecordLineCategoryList`、`DescribeRecordList`、`CreateRecord`、`ModifyRecordFields` 权限。填写记录 ID 时，或创建后等待 DNSPod 索引期间，还会调用 `DescribeRecord`。
2. 在「DDNS 状态」添加记录，将提供商设为「腾讯云 DNSPod（中国站）」，填写解析域名、完整记录名称和来源节点。例如，解析域名填 `example.com`，记录名称填 `home.example.com`。根域名记录的两个字段均填 `example.com`。
3. 填写解析域名后，页面按 DNSPod 返回的分类逐级显示可用线路。例如，选择「电信」后可选该套餐支持的细分线路，也可停在「电信」。选好线路后填写 TTL，按需填写权重，保存并点击「立即同步全部」。免费版最低 TTL 为 600 秒，专业版为 60 秒，企业版和尊享版为 1 秒。 [DNSPod 线路查询](https://cloud.tencent.com/document/product/1427/104320) · [腾讯云 TTL 说明](https://cloud.tencent.com/document/product/302/9072)

升级后，旧 DNSPod 配置中的固定 TTL 会继续生效。旧选项为「自动」时，已有云端记录保留其 TTL，创建缺失记录时使用 600 秒。编辑这类配置时可录入明确的 TTL。配置了具体秒数后，即使 IP 没有变化，也会同步 TTL。

同一名称和类型可以按不同线路配置。留空记录 ID 时，插件在选定线路查找或创建记录。要移动已有记录的线路，编辑时同时填写该记录的 DNSPod 记录 ID。管理页的删除操作会停止同步，对应的云端记录仍可在 DNSPod 控制台管理。

## 华为云 DNS 配置

1. 在插件配置填写华为云中国站 AK 和 SK。插件通过华北-北京四端点管理公网域名。IAM 用户需要查询公网域名和系统线路，以及查询、创建和修改记录集的权限。加载自定义线路与线路分组还需相应的列表权限。 [华为云记录集 API](https://support.huaweicloud.com/api-dns/topic_300000003.html)
2. 在「DDNS 状态」添加记录，选择「华为云 DNS（中国站）」，填写解析域名和完整主机名。页面会加载系统线路和账号可用的自定义线路、线路分组。例：选「运营商线路 → 电信 → 华北地区 → 天津」，实际提交的线路 ID 为 `Dianxin_Tianjin`；也可以停在运营商或大区一级。建议为同一主机名和记录类型配置全网默认线路。 [华为云线路 ID](https://support.huaweicloud.com/api-dns/zh-cn_topic_0085546214.html)
3. 选择来源节点并设置 TTL，按需填写权重。权重留空时，新建公网记录集使用华为云默认权重 1，已有记录集保留原值。华为云的权重 `0` 表示备用。 [华为云创建记录集](https://support.huaweicloud.com/api-dns/dns_api_64001.html)

华为云 DDNS 管理单 IP 的非别名记录集。填写记录集 ID 时，主机名、类型和线路必须与该记录集匹配。需要换线路时，可为目标线路配置一条 DDNS 记录，并在华为云控制台管理原线路记录。

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

- `node`：使用 `fs` 持久化状态到长期存储目录，使用 `crypto` 为 DNSPod 和华为云 API 请求签名；
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
