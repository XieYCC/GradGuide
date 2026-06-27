# GradGuide 小程序云开发方案

## 概述

将 GradGuide 留学选校小程序从纯前端（硬编码数据 + globalData 内存状态）改造为微信原生云开发架构，实现用户数据持久化、学校数据可配置、诊断流程云端化，并预留微信支付能力。

## 当前架构（改造前）

```
utils/data.js (硬编码 21 条 Program)
  ↓
app.globalData (内存状态，冷启动重置)
  ↓
各页面 Page() 直接读取渲染
  ↓
无用户系统，无持久化，无真实支付
```

## 目标架构（改造后）

```
云数据库 (programs / users / benchmarks / orders)
  ↓
云函数 (15 个独立函数)
  ↓
小程序前端调用 wx.cloud.callFunction()
  ↓
各页面渲染
  ↓
微信登录自动关联用户，数据跨 session 持久化
```

## 云数据库设计

### users 集合

```json
{
  "_id": "<自动>",
  "_openid": "<微信 openid>",
  "createdAt": <Date>,
  "updatedAt": <Date>,
  "profile": {
    "school": "武汉大学",
    "schoolLevel": "985",
    "major": "计算机科学与技术",
    "gradYear": "2026（大三）",
    "gpa": 3.65,
    "gpaScale": "/4.0",
    "rank": "15/120",
    "toefl": 98,
    "gre": 0,
    "greText": "未考",
    "research": [{ "name": "字节跳动 AI Lab 暑研", "type": "知名实验室暑研" }],
    "internships": [{ "name": "腾讯 后端开发实习", "type": "大厂(BAT/MAANG)" }],
    "recommendation": ["海外名校教授", "国内本校教授（有 publication）", "普通课程任课老师"],
    "targetRegions": ["美国", "香港"],
    "targetMajors": ["CS", "DS"],
    "priority": "学校排名"
  },
  "favorites": ["<program_id_1>", "<program_id_2>"],
  "simHistory": [
    {
      "timestamp": <Date>,
      "state": { "gpa": 3.65, "toefl": 98, "gre": 0, "paper": false, "research": false, "intern": false, "award": false },
      "score": 73,
      "tier": { "reach": 5, "match": 10, "safe": 6 },
      "unlocked": ["CMU MSCS"]
    }
  ]
}
```

### programs 集合

从 `utils/data.js` 迁移而来，每条记录对应一个学校项目：

```json
{
  "_id": "<自动>",
  "school": "Carnegie Mellon University",
  "shortName": "CMU",
  "country": "US",
  "region": "美国",
  "major": "CS",
  "rank": "US #3",
  "minGpa": 3.7,
  "avgGpa": 3.85,
  "toefl": 100,
  "gre": "325+",
  "tier": "reach",
  "deadline": "12月10日",
  "tuition": "$70,000/年",
  "duration": "16个月",
  "highlight": "CS 全美第一，强调科研背景",
  "enabled": true
}
```

### benchmarks 集合

```json
[
  { "tier": "reach",  "dimensions": [88, 82, 80, 80, 75, 85, 75] },
  { "tier": "match",  "dimensions": [80, 75, 75, 75, 70, 80, 68] },
  { "tier": "safety", "dimensions": [70, 65, 60, 55, 60, 60, 55] }
]
```

### orders 集合

```json
{
  "_id": "<自动>",
  "_openid": "<微信 openid>",
  "type": "essay",
  "amount": 999,
  "status": "pending | paid | refunded",
  "outTradeNo": "wx_<timestamp>_<random>",
  "createdAt": <Date>,
  "paidAt": <Date>
}
```

## 云函数设计（共 15 个）

### 用户类（3 个）

| 云函数 | 职责 |
|--------|------|
| `login` | 获取 openid，首次登录自动创建 users 记录（空 profile） |
| `getUser` | 读取当前用户的完整数据（profile + favorites + simHistory） |
| `saveProfile` | 保存档案，支持部分更新。前端 5 步各自调用，传什么字段更新什么 |

### 选校类（3 个）

| 云函数 | 职责 |
|--------|------|
| `getPrograms` | 获取项目列表，支持 region + major 筛选参数 |
| `getProgramDetail` | 获取单个项目的完整详情 |
| `searchPrograms` | 按关键词搜索项目（学校名 / 专业名模糊匹配） |

### 收藏类（3 个）

| 云函数 | 职责 |
|--------|------|
| `addFavorite` | 收藏一个项目，programId 写入 users.favorites 数组 |
| `removeFavorite` | 取消收藏，从 users.favorites 移除 |
| `getFavorites` | 获取用户收藏列表（联表查询返回项目详情） |

### 诊断类（2 个）

| 云函数 | 职责 |
|--------|------|
| `getBenchmarks` | 获取各档位的 7 维基准数据 |
| `compareProfile` | 传入用户 profile，返回与目标档位的各项差距分析 |

### 模拟器类（3 个）

| 云函数 | 职责 |
|--------|------|
| `saveSimResult` | 保存一次模拟结果（参数快照 + 分数 + 档位）到 users.simHistory |
| `getSimHistory` | 获取用户的模拟历史记录列表 |
| `deleteSimResult` | 根据 simHistory 中的索引或 timestamp 删除某条记录 |

### TODO 类（1 个）

| 云函数 | 职责 |
|--------|------|
| `generateTodos` | 根据用户档案短板，智能生成本周/本月/本季度个性化 TODO |

### 支付类（3 个）

| 云函数 | 职责 |
|--------|------|
| `wxPayUnifiedOrder` | 微信支付统一下单，生成 outTradeNo + prepay_id |
| `wxPayQuery` | 根据 outTradeNo 查询订单支付状态 |
| `wxPayNotify` | 接收微信支付异步回调，更新 orders 状态 |

## 关键数据流

### 核心诊断流程（数据持久化后）

```
用户打开小程序
  ↓
login → 获取 openid → 首次则创建 users 记录
  ↓
首页 onShow → getUser → 如有 profile 则展示"继续上次诊断"
  ↓
进入 profile 页 → 5 步填写 → 每步调用 saveProfile 部分更新
  ↓
进入 match 页 → getPrograms(region, major) → 前端 calcTier 三档分类渲染
  ↓
点击收藏 → addFavorite(programId) → 更新 users.favorites
  ↓
进入 diagnosis 页 → getBenchmarks(tier) → 前端 canvas 绘制雷达图
  ↓
进入 simulator 页 → 调滑块 → saveSimResult 保存每次结果
  ↓
进入 essay 页 → wxPayUnifiedOrder → wx.requestPayment → wxPayNotify → 展示内容
```

### 用户数据流向

```
前端 Page data  ←  setData()  ←  wx.cloud.callFunction  →  云函数  →  云数据库
                    ↑                                               ↓
                    └──────────── app.globalData (缓存) ←────────────┘
```

`app.globalData` 仍然用作 session 级缓存，但初始值从云数据库加载，修改时同时写入云数据库。

## 云存储设计

| 用途 | 路径规则 | 说明 |
|------|---------|------|
| 文书草稿 | `users/{openid}/essays/{type}.md` | 用户生成的文书草稿，后期扩展 |
| 诊断分享图 | `users/{openid}/diagnosis/{timestamp}.png` | 用户分享的诊断雷达图截图 |

## 微信支付流程

```
用户在文书页选择类型 → 填写信息 → 点击"解锁完整文书"
  ↓
前端调 wxPayUnifiedOrder({ type, amount, description })
  ↓
云函数生成 outTradeNo → 调微信统一下单 API → 返回 prepay_id
  ↓
前端收到 { prepay_id, outTradeNo, sign } →
  调 wx.requestPayment({ timeStamp, nonceStr, package: prepay_id, signType, paySign })
  ↓
用户输入支付密码
  ↓
成功 → 前端调 wxPayQuery({ outTradeNo }) 轮询确认状态
  ↓
微信异步回调 wxPayNotify → orders.status = "paid"
  ↓
前端确认已支付 → 展示完整文书内容
  ↓
失败 → 展示错误提示，可重试
```

## 前端改造要点

### app.js

```javascript
// 改造前
App({
  globalData: {
    userProfile: { ... },  // 硬编码默认值
    simState: { ... }
  }
})

// 改造后
App({
  globalData: {
    userProfile: null,   // 初始为 null，onLaunch 时从云端加载
    simState: null,
    isLoggedIn: false
  },
  onLaunch() {
    wx.cloud.init({ env: 'your-env-id' })
    this.loginAndLoad()
  },
  async loginAndLoad() {
    const res = await wx.cloud.callFunction({ name: 'login' })
    const user = await wx.cloud.callFunction({ name: 'getUser' })
    this.globalData.userProfile = user.result.profile || {}
    this.globalData.isLoggedIn = true
  }
})
```

### 页面改造模式

每个页面增加一个 `loadFromCloud()` 方法，在 `onShow()` 中调用：

```javascript
// 改造前
Page({
  onLoad() {
    this.setData({ profile: app.globalData.userProfile })
  }
})

// 改造后
Page({
  async onShow() {
    if (!app.globalData.isLoggedIn) {
      await app.loginAndLoad()
    }
    this.setData({ profile: app.globalData.userProfile })
  }
})
```

Profile 页面每步提交时：

```javascript
// 改造前
saveProfile() {
  app.globalData.userProfile = this.data.profile
}

// 改造后
async saveProfile() {
  app.globalData.userProfile = this.data.profile
  await wx.cloud.callFunction({
    name: 'saveProfile',
    data: this.data.profile  // 只传当前步骤涉及字段
  })
}
```

## 错误处理设计

每个云函数调用都需要处理以下场景：

| 场景 | 前端表现 |
|------|---------|
| 网络异常 | wx.showToast('网络异常，请稍后重试')，保留本地缓存可读 |
| 云函数超时 | 展示重试按钮，不阻塞用户操作 |
| openid 获取失败 | 提示"登录状态异常，请重启小程序" |
| 支付失败 | 展示具体错误码提示，保留用户输入不丢失 |
| 首次登录无数据 | 空 profile 正常渲染，引导用户填写 |

核心原则：**云端不可用时，前端仍可展示本地缓存数据（降级体验），不可白屏。**

## 分阶段实施

### Phase 1：用户系统 + 数据云端化

范围：
- 创建云开发环境，初始化 4 个集合并导入数据
- 编写：`login`、`getUser`、`saveProfile`、`getPrograms`、`getBenchmarks`
- 改造页面：app.js（初始化）、首页（读取 profile）、选校页（云端数据）、诊断页（云端基准）、Profile 页（持久化存储）

产出：用户数据跨 session 持久化，改学校数据不发版。

### Phase 2：收藏 + 模拟器 + TODO

范围：
- 编写：`addFavorite`、`removeFavorite`、`getFavorites`、`saveSimResult`、`getSimHistory`、`deleteSimResult`、`generateTodos`
- 改造页面：选校页（收藏按钮）、模拟器（历史记录）、TODO 页（云端生成）

产出：核心功能闭环完全云端化。

### Phase 3：微信支付

范围：
- 配置微信支付商户号
- 编写：`wxPayUnifiedOrder`、`wxPayQuery`、`wxPayNotify`
- 改造页面：文书页（真支付真解锁）

产出：开始产生收入。

## 数据安全规则

云数据库基础权限设置：

```
users:  只允许用户读写自己的记录（doc._openid == auth.openid）
programs: 所有用户可读，仅管理员可写
benchmarks: 所有用户可读
orders: 只允许用户读自己的记录，云函数写
```

## 附录：当前数据迁移

`utils/data.js` 中的 21 条 `PROGRAMS` 数据需迁移到云数据库 `programs` 集合。建议编写一个一次性迁移脚本（在云函数或本地 Node.js 中运行），保持字段结构不变，新增 `enabled: true` 字段。
