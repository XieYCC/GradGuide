# GradGuide

> 面向中国学生的研究生申请规划小程序 —— 把「选校 → 诊断 → 模拟 → 文书」串成一条连贯的申请决策链。

GradGuide 帮助本科在读 / 应届生在手机上（微信小程序内）随时随地规划选校、定位自身差距、模拟「如果提升某项成绩会怎样」、起草申请文书。让一个普通学生用几分钟看清自己的申请画像与提升空间，而不是被中介话术或零散信息裹挟。

品牌人格：**温暖 · 陪伴 · 鼓励** —— 像一个懂行且站在你这边的学长 / 顾问。视觉基线偏冷静专业（主色深绿 `#2e5d50`、极简、无渐变），同时在措辞与交互上注入陪伴感。

---

## 一、项目介绍

### 核心功能

| 模块 | 说明 |
|------|------|
| **选校匹配** | 按地区（美 / 港 / 英）× 专业（CS / MKT）筛选项目库，按冲刺 / 匹配 / 保底三档分层展示，云端实时计算命中档位 |
| **差距诊断** | Canvas 绘制 7 维雷达图，对比用户画像与目标档位基准，指出短板所在 |
| **What-if 模拟** | 拖动 GPA / TOEFL / GRE 滑杆 + 勾选提升项，实时重算综合评分与档位变化，并生成个性化 TODO |
| **AI 辅助文书** | 选择文书类型 → 填写背景 → 免费预览 → 付费解锁全文（CSS blur 付费墙） |
| **个人中心** | 档案汇总、模拟历史、收藏管理、弱动效偏好设置 |

### 技术栈

- **前端**：原生微信小程序（WXML / WXSS / ES5-ES6），无 Vue / React，无构建步骤，前端无 npm 依赖。启用 WeUI 扩展组件库。
- **后端**：微信云开发（云函数 + 云数据库）。云函数基于 Node.js + `wx-server-sdk`，每个函数独立 `package.json`。
- **匹配算法**：集中实现于 `cloudfunctions/matchPrograms/match-logic.js`，被 `matchPrograms` / `saveProfile` / `simulateMatcher` 三个云函数共用，是档位与评分的单一事实源。

### 目录结构

```
miniprogram/
├── app.js / app.json / app.wxss      # 小程序入口与全局配置/样式
├── design-token.wxss                 # 设计令牌（CSS 变量）
├── pages/                            # 页面（见下表）
├── utils/                            # 前端工具：data.js(静态兜底) / util.js(评分/档位)
├── styles/                           # 共享样式（profile-step 等）
├── cloudfunctions/                   # 云函数（18 个，见部署章节）
├── tests/                            # 纯 Node assert 测试，无框架
├── images/  assets/                  # 图标与素材
├── PRODUCT.md                        # 产品定位与品牌声音
└── project.config.json               # 小程序工程配置
```

### 页面结构

TabBar 共 4 个标签：首页 / 选校 / 诊断 / 我的。

| 页面 | Tab | 职责 |
|------|:---:|------|
| `onboarding` | — | 首次引导，未完成则拦截其余页面 |
| `home` | ✅ | 落地页：hero、快速预测、价值主张、流程引导 |
| `match` | ✅ | 选校列表，按地区 × 专业筛选，三档分层卡片（数据来自云端） |
| `diagnosis` | ✅ | Canvas 7 维雷达图，对比用户 vs 目标档位基准 |
| `mine` | ✅ | 「我的」：档案汇总、设置（弱动效开关）、入口集合 |
| `profile/step1..5` | — | 5 步档案向导（学校层次 → 毕业年份 → 成绩 → 经历 → 目标），`profile/init` 为入口 |
| `simulator` | — | What-if 滑杆 + 提升项勾选 → 实时评分 / 档位 + TODO 清单 |
| `sim-history-detail` | — | 模拟历史详情 |
| `essay` | — | AI 文书生成器：选类型 → 填表 → 免费预览 → 付费墙 → 全文 |

> 数据流：用户填写档案 → `saveProfile` 云函数部分更新 `users.profile` 并自动重算 `matchResult` → 各页通过 `app.loginAndLoad()` 加载，页面可实现 `onProfileReady()` 钩子接收就绪通知。

---

## 二、如何使用 & 部署

### 环境要求

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版即可）
- Node.js ≥ 16（仅云函数本地依赖安装与跑测试用；前端无需 Node）
- 一个已认证的微信小程序账号（用于云开发配额）

### 关键参数

| 项 | 值 |
|----|----|
| AppID | `wx207f70f228ee3db5` |
| 云开发环境 ID | `cloud1-d7guh4c7wcad0635c` |
| SDK 基础库版本 | `3.16.2` |

> AppID 与云环境 ID 已写入 `project.config.json` 与 `app.js`。若你 fork 后使用自己的小程序账号，需替换这两处。

### 1. 本地运行（前端）

无需 `npm install`，无需构建：

1. 打开微信开发者工具 → **导入项目** → 选择本仓库根目录 `miniprogram/`。
2. 确认 AppID、云开发环境 ID 与上表一致。
3. 点击 **编译** / **预览** 即可在模拟器或手机扫码运行。

### 2. 部署云函数

云函数目录为 `cloudfunctions/`（`project.config.json` 中 `cloudfunctionRoot` 指向它）。**首次运行或云函数有改动时必须部署**，否则前端调用会失败。

#### 方式 A：开发者工具 GUI（推荐）

1. 在开发者工具中打开云开发控制台，确认环境为 `cloud1-d7guh4c7wcad0635c`。
2. 右键 `cloudfunctions/` 下每个函数文件夹 → **上传并部署：云端安装依赖**（勾选「云端安装依赖」以避免本地 node_modules 版本不一致）。
3. 首次需部署全部 18 个函数；后续按改动函数选择性部署即可。

#### 方式 B：开发者工具 CLI

```bash
# Windows 路径示例（按你的安装位置调整）
CLI="<微信开发者工具安装目录>/cli.bat"

"$CLI" cloud functions deploy \
  --project "<本仓库本地路径>" \
  --env cloud1-d7guh4c7wcad0635c \
  --names login getUser saveProfile \
  --remote-npm-install
```

- `--names` 接受空格分隔的多个函数名；`--remote-npm-install` 让云端安装依赖。
- 部署前需开启开发者工具的 **设置 → 安全设置 → 服务端口**，CLI 才能调用。

#### 云函数清单

| 分组 | 函数 |
|------|------|
| 认证 / 用户 | `login`（首次自动建用户记录）、`getUser`、`saveProfile`（部分更新 + 自动重算匹配）、`migrateData`（一次性迁移，控制台手动调用） |
| 项目库 | `getPrograms`、`getProgramDetail`、`searchPrograms` |
| 匹配 / 模拟 | `matchPrograms`、`simulateMatcher`、`compareProfile`、`getBenchmarks`、`generateTodos` |
| 收藏 | `addFavorite`、`removeFavorite`、`getFavorites` |
| 模拟历史 | `saveSimResult`、`getSimHistory`、`deleteSimResult` |

### 3. 初始化云数据库

项目使用两个集合，部署云函数后按需在云开发控制台 → 数据库手动创建（若 `login` 首次写入时集合不存在会报错）：

- **`users`**：`_openid, profile, wxProfile, favorites[], simHistory[], matchResult, matchResultUpdatedAt, createdAt, updatedAt`
- **`programs`**：项目库。字段参照 `utils/data.js` 中 `PROGRAMS` 的 schema（`school, country, region, major, rank, minGpa/avgGpa, toefl, gre, tier, deadline, tuition, duration, highlight, selectivityBand, enabled`）。`enabled` 为 `true` 才会被 `getPrograms` / `matchPrograms` 查询到。

> 初始项目数据可用 `migrateData` 云函数或控制台批量导入；新增 / 修改项目应直接维护云端 `programs` 集合，`utils/data.js` 的静态数组仅作降级兜底。

### 4. 运行测试

测试为纯 Node `assert` 脚本，无框架、无根 `package.json`，逐个运行：

```bash
node tests/calc-diff.test.js
node tests/match-allocation-v2.test.js
node tests/simulator-score-consistency.test.js
node tests/login-wxprofile.test.js
# ...其余同理
```

改动 `cloudfunctions/matchPrograms/match-logic.js` 或登录 / 档案逻辑后，请运行相关测试。

### 5. 常见问题

- **前端调用云函数报错 / 返回空**：检查云函数是否已部署、环境 ID 是否一致、`programs` 集合是否有 `enabled: true` 的记录。
- **模拟器无数据**：`login` 会在首次登录创建空 `users` 记录；若集合未创建会失败，先在控制台建集合。
- **换自己的账号**：替换 `project.config.json` 的 `appid` 与 `app.js` 中 `wx.cloud.init` 的 `env`，并在自己的云环境重新部署全部云函数 + 建集合。

---

## 设计与协作约定

- 设计令牌在 `design-token.wxss` + `app.wxss`；硬约束：**无渐变、无 emoji 图标（用 Remix Icon / 小程序图标）、无玻璃态**。
- 全局状态在 `app.globalData`：`userProfile`（纯档案字段）与 `wxProfile`（微信资料）分离存放，加载时合并而非覆盖，避免冲掉本地刚编辑的字段。
- 匹配 / 评分逻辑统一走 `match-logic.js`，请勿在页面内重复实现。
- 面向 AI 编码助手的工程指引见 `.claude/CLAUDE.md`。
