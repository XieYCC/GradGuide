# GradGuide 首次加载分段缓存优化设计

> Date: 2026-06-27
> Author: Claude Code
> Status: 设计完成，待实现

---

## 1. 问题背景

### 1.1 现状分析

当前首次登录/冷启动流程存在以下性能问题：

```
冷启动时序（平均 3-5 秒）
────────────────────────────────────────────────────────
0ms     onLaunch
300ms   login() 云函数冷启动 ──┐
1100ms  getUser() ──────────────┤→ 串行，2次冷启动
1900ms  onProfileReady 触发
        后台并行: matchPrograms + getBenchmarks + getFavorites
        ↓ 用户切换 Tab
2200ms  match 页面再次调用 getUser() + matchPrograms() ← 重复请求！
────────────────────────────────────────────────────────
```

### 1.2 核心问题

| 问题 | 影响 |
|------|------|
| 云函数串行调用 | `login` + `getUser` 两次冷启动，累计 +2-6 秒 |
| 重复请求 | `getUser` / `matchPrograms` 在 app.js 和页面各调一次 |
| 竞态条件 | 预加载未完成时切页 → 页面发起重复请求 |
| 无降级缓存 | 网络慢时只能看骨架屏，无旧数据可用 |

---

## 2. 设计目标

### 2.1 体验目标

```
用户打开小程序
  ↓
✅ 0.1秒：显示缓存的历史数据（秒开，无骨架屏）
  ↓
✅ 后台静默刷新（用户无感）
  ↓
✅ 有新数据 → 平滑更新 UI（不打断用户操作）
  ↓
✅ 切页 → 直接读内存缓存，0 网络请求
```

### 2.2 性能指标

| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| 冷启动云函数调用次数 | 5 次 | **1 次** | ⬇️ 80% |
| 选校页面首次响应 | 500-1500ms | **0ms** | ⬇️ 100% |
| 诊断页面首次响应 | 300-800ms | **0ms** | ⬇️ 100% |
| 离线可用性 | 不可用 | **显示最后一次数据** | ✅ |

---

## 3. 整体架构

### 3.1 三层缓存设计

```
┌─────────────────────────────────────────────────────────────┐
│                    三层缓存架构                                │
├─────────────────────────────────────────────────────────────┤
│  L1: 内存缓存 (app.globalData._cache)                        │
│    - 命中时间: 0ms                                          │
│    - 用途: 切页秒开，页面间共享数据                          │
├─────────────────────────────────────────────────────────────┤
│  L2: 本地 Storage 持久化 (wx.setStorageSync)                 │
│    - 命中时间: <10ms                                         │
│    - 用途: 冷启动秒开显示旧数据，网络差时降级                  │
├─────────────────────────────────────────────────────────────┤
│  L3: 云端合并请求 (getUserBundle 云函数)                     │
│    - 命中时间: 300-800ms (仅 1 次冷启动)                     │
│    - 用途: 后台静默刷新，一次性返回所有数据                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 数据流转

```
冷启动
  │
  ├─ [同步] 读 L2 Storage → 写入 L1 内存
  ├─ [同步] 通知页面：有缓存直接渲染
  │
  └─ [异步] 发起 getUserBundle 请求
          │
          ├─ 成功 → 更新 L1 + L2 → 通知页面增量更新
          └─ 失败 → 保持旧缓存，静默重试
```

---

## 4. 详细设计

### 4.1 云函数合并：`getUserBundle`

**路径**：`cloudfunctions/getUserBundle/`

**功能**：一次性返回用户所需的所有核心数据，避免多次云函数冷启动

#### 入参

```javascript
// 无参数，从 cloud context 获取 OPENID
```

#### 出参格式

```javascript
{
  // 用户档案
  profile: {
    school: '清华大学',
    schoolLevel: '985',
    gpa: 3.7,
    toefl: 105,
    gre: null,
    targetMajors: ['CS', 'DS'],
    targetRegions: ['美国', '香港'],
    // ... 其他档案字段
  },

  // 微信资料（头像/昵称）
  wxProfile: {
    avatarUrl: 'https://...',
    nickName: '张三'
  },

  // 选校匹配结果
  matchResult: {
    reach: [/* 冲刺档项目列表 */],
    match: [/* 匹配档项目列表 */],
    safety: [/* 保底档项目列表 */],
    extremeReachCount: 3,
    calculatedAt: 1687654321000
  },

  // 诊断基准数据
  benchmarks: {
    reach: [88, 82, 80, 80, 75, 85, 75],
    match: [80, 75, 75, 75, 70, 80, 68],
    safety: [70, 65, 60, 55, 60, 60, 55]
  },

  // 收藏的项目 ID 列表
  favorites: ['program_id_1', 'program_id_2'],

  // 数据时间戳，用于缓存校验
  timestamp: 1687654321000
}
```

#### 内部执行逻辑

```javascript
1. 获取 OPENID from cloud context
2. 并行查询:
   ├─ db.collection('users').doc(openid).get()
   ├─ db.collection('programs').where({ enabled: true }).get()  // 构建基准用
   └─ db.collection('favorites').where({ userId: openid }).get()
3. 检查 users 记录中是否已有 matchResult
   ├─ 有且未过期（24 小时内）→ 直接使用
   └─ 无或已过期 → 调用 match-logic.js 计算新的匹配结果
4. 一次性组装 bundle 返回
```

---

### 4.2 前端缓存管理器：`CacheManager`

**路径**：`utils/cache-manager.js`

#### 缓存配置

```javascript
const CACHE_CONFIG = {
  // TTL: 各数据过期时间
  ttl: {
    matchResult: 2 * 60 * 60 * 1000,    // 匹配结果：2 小时
    benchmarks: 7 * 24 * 60 * 60 * 1000, // 基准数据：7 天
    favorites: 10 * 60 * 1000,           // 收藏列表：10 分钟
    profile: 1 * 60 * 60 * 1000          // 用户档案：1 小时
  },

  // Storage 键名前缀
  keyPrefix: 'gradguide_cache_',

  // 需要缓存的键名列表
  keys: ['matchResult', 'benchmarks', 'favorites', 'profile', 'wxProfile']
}
```

#### 对外接口

```javascript
class CacheManager {
  /**
   * 从 L2 Storage 加载所有缓存到 L1 内存
   * 冷启动时调用一次
   */
  loadAllFromStorage(): void

  /**
   * 检查某个 key 的缓存是否有效（存在且未过期）
   */
  isValid(key: string): boolean

  /**
   * 从 L1 内存读缓存
   */
  get(key: string): any | null

  /**
   * 写入缓存：同时更新 L1 内存 + L2 Storage
   */
  set(key: string, data: any): void

  /**
   * 批量写入 bundle 数据
   */
  setBundle(bundle: BundleResult): void

  /**
   * 清空所有缓存（开发者工具用）
   */
  clearAll(): void
}
```

---

### 4.3 App.js 改造

**路径**：`app.js`

#### 新增成员

```javascript
App({
  globalData: {
    // ... 现有字段不变
    _cache: {
      matchResult: null,
      benchmarks: null,
      favorites: null,
      profile: null,
      wxProfile: null,
      _timestamps: {}  // 各 key 的写入时间戳
    }
  },

  // 进行中的 bundle 请求 Promise，用于去重等待
  _bundlePromise: null,

  // 缓存管理器实例
  cacheManager: new CacheManager()
})
```

#### 登录流程改造

```javascript
async loginAndLoad() {
  // ─── 阶段 1：读本地缓存，秒级渲染 ───
  const hasValidCache = this.cacheManager.loadAllFromStorage()
  if (hasValidCache) {
    // 有有效缓存：立即通知页面渲染旧数据
    this._notifyPagesDataReady()
    console.log('[cache] loaded from storage, rendering immediately')
  }

  // ─── 阶段 2：请求去重，避免并发 ───
  if (this._bundlePromise) {
    return this._bundlePromise
  }

  // ─── 阶段 3：后台静默刷新 ───
  try {
    this._bundlePromise = wx.cloud.callFunction({ name: 'getUserBundle' })
    const bundle = await this._bundlePromise

    // 更新 L1 + L2 缓存
    this.cacheManager.setBundle(bundle.result)

    // 更新全局状态
    this.globalData.userProfile = bundle.result.profile
    this.globalData.wxProfile = bundle.result.wxProfile
    this.globalData.isLoggedIn = true

    // 通知所有页面：数据已更新，可以增量刷新
    this._notifyPagesDataUpdated()

    console.log('[bundle] loaded from cloud, cache updated')
  } catch (err) {
    console.error('[loginAndLoad] bundle request failed', err)
    // 失败不报错，保持旧缓存继续使用
  } finally {
    this._bundlePromise = null
  }
},

/**
 * 通知页面缓存已就绪（第一次有数据）
 */
_notifyPagesDataReady() {
  const pages = getCurrentPages()
  pages.forEach(page => {
    if (typeof page.onCacheReady === 'function') {
      page.onCacheReady()
    }
  })
},

/**
 * 通知页面云端数据已刷新（增量更新）
 */
_notifyPagesDataUpdated() {
  const pages = getCurrentPages()
  pages.forEach(page => {
    if (typeof page.onCacheUpdated === 'function') {
      page.onCacheUpdated()
    }
  })
},

// --- 对外读取接口（页面调用，向后兼容）---
getCachedMatchResult() { return this.cacheManager.get('matchResult') },
getCachedBenchmarks() { return this.cacheManager.get('benchmarks') },
getCachedFavorites() { return this.cacheManager.get('favorites') }
```

---

### 4.4 页面适配改造

#### 通用页面生命周期

所有 Tab 页面实现以下两个钩子：

```javascript
Page({
  /**
   * L2 缓存已加载完成（仅冷启动时调用一次）
   * 优先渲染旧数据，用户立即看到内容
   */
  onCacheReady() {
    const cached = app.getCachedMatchResult()
    if (cached && cached.reach) {
      this.setData({
        reach: cached.reach,
        match: cached.match,
        safety: cached.safety,
        loading: false,   // 关闭骨架屏
        noMatchData: false
      })
    }
  },

  /**
   * 云端数据已刷新，增量更新 UI
   * 只更新变化的部分，不闪烁
   */
  onCacheUpdated() {
    const fresh = app.getCachedMatchResult()
    if (fresh) {
      // 静默更新数据，不打断用户操作
      this.setData({
        reach: fresh.reach,
        match: fresh.match,
        safety: fresh.safety
      })
    }
  }
})
```

#### 各页面具体改动

| 页面 | 需要做的改动 |
|------|-------------|
| `pages/home/home.js` | `onCacheReady` 同步 profile 状态，显示快速预测 |
| `pages/match/match.js` | `onCacheReady` 渲染旧匹配结果，`onCacheUpdated` 静默刷新 |
| `pages/diagnosis/diagnosis.js` | `onCacheReady` 渲染旧雷达数据，`onCacheUpdated` 重绘 |
| `pages/mine/mine.js` | `onCacheReady` 显示档案快照，`onCacheUpdated` 更新 |

---

### 4.5 骨架屏降级策略

骨架屏现在只在**真正的首次登录**（无任何缓存）时显示：

```javascript
// pages/match/match.js
onLoad() {
  const cached = app.getCachedMatchResult()
  if (cached && cached.reach) {
    // 有缓存：直接渲染，不显示骨架屏
    this.renderFromCache(cached)
  } else {
    // 真·第一次：显示骨架屏
    this.setData({ loading: true })
  }
}
```

---

## 5. 向后兼容

### 5.1 旧云函数保留

以下云函数继续保留，用于：
- `getUser` → 档案保存后手动刷新
- `matchPrograms` → 档案更新后重新计算
- `getBenchmarks` → 兜底备用
- `getFavorites` → 收藏操作后手动刷新

### 5.2 页面原有逻辑保留

页面原有的 `loadMatchResult()` / `loadBenchmarks()` 等方法不变，作为缓存失效时的降级方案。

---

## 6. 错误处理与边界情况

| 场景 | 处理方式 |
|------|---------|
| 首次登录无缓存 | 显示骨架屏，等待 bundle 返回 |
| bundle 请求失败 | 保持旧缓存，静默不报错；下次启动自动重试 |
| 缓存已过期 | 先显示旧数据，后台刷新成功后平滑更新 |
| 网络中断 | 继续显示旧数据，下次进入自动刷新 |
| 档案刚修改 | `saveProfile` 后调用 `app.cacheManager.set('profile', newProfile)` |

---

## 7. 实现步骤

### Phase 1：云函数（优先级：高）
1. 新建 `getUserBundle` 云函数
2. 复制 `match-logic.js` 到新云函数
3. 实现 bundle 组装逻辑
4. 测试并部署

### Phase 2：缓存管理器（优先级：高）
1. 新建 `utils/cache-manager.js`
2. 实现 TTL 校验、Storage 读写、批量更新

### Phase 3：App.js 改造（优先级：高）
1. 集成 CacheManager
2. 改造 `loginAndLoad()` 流程
3. 实现 `_notifyPagesDataReady/Updated` 通知机制

### Phase 4：页面适配（优先级：中）
1. `match.js` 适配缓存钩子
2. `diagnosis.js` 适配缓存钩子
3. `mine.js` 适配缓存钩子
4. `home.js` 适配缓存钩子

### Phase 5：测试与验证（优先级：高）
1. 清除缓存测试首次登录
2. 正常冷启动测试秒开效果
3. 断网降级测试
4. 切页 0 网络请求验证

---

## 8. 回滚方案

如果线上发现问题，一键回滚：
1. 恢复 `app.js` 原有的 `login` + `getUser` 串行调用
2. 页面恢复原有的 `onProfileReady` 逻辑
3. `getUserBundle` 云函数保留不删（不影响）

---

## 9. 后续优化方向（v2）

- [ ] 预加载分页拆分：首页数据优先，非首屏延迟加载
- [ ] 增量缓存：只更新变化的字段，减少 setData 量
- [ ] 预取策略：预测用户下一步操作，提前加载下一页数据
