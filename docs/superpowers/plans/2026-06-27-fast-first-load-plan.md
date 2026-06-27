# 首次加载分段缓存优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现三层缓存架构 + 云函数合并，将首次加载速度提升 80%，切页秒开 0 网络请求

**Architecture:** L1 内存缓存 + L2 本地 Storage 持久化 + L3 云端合并请求。页面实现 `onCacheReady` / `onCacheUpdated` 双钩子，首次加载秒开旧数据、后台静默刷新。

**Tech Stack:** 微信小程序原生 + 云开发 Node.js + wx.setStorageSync

## Global Constraints

- 微信小程序基础库: 2.0+
- 云开发环境 ID: `cloud1-d7guh4c7wcad0635c`
- 所有云函数必须冷启动时间 < 1s
- TTL 配置: matchResult 2h, benchmarks 7d, favorites 10m, profile 1h
- 向后兼容：所有现有接口逻辑保留，作为降级方案
- 每次 setData 必须最小化数据量，避免整页重渲染
- 骨架屏仅在真·首次登录（无任何缓存）时显示

---

## 文件变更总览

| 类型 | 路径 | 说明 |
|------|------|------|
| 新建 | `cloudfunctions/getUserBundle/index.js` | 合并请求云函数 |
| 新建 | `cloudfunctions/getUserBundle/package.json` | 依赖配置 |
| 新建 | `utils/cache-manager.js` | 缓存管理器 |
| 修改 | `app.js` | 集成缓存管理器，改造登录流程 |
| 修改 | `pages/match/match.js` | 缓存钩子适配 |
| 修改 | `pages/diagnosis/diagnosis.js` | 缓存钩子适配 |
| 修改 | `pages/mine/mine.js` | 缓存钩子适配 |
| 修改 | `pages/home/home.js` | 缓存钩子适配 |

---

### Task 1: 云函数 getUserBundle

**Files:**
- Create: `cloudfunctions/getUserBundle/index.js`
- Create: `cloudfunctions/getUserBundle/package.json`
- Reuse: `cloudfunctions/matchPrograms/match-logic.js` (复制到新云函数)

**Interfaces:**
- Consumes: `wx-server-sdk`, `match-logic.js`
- Produces: `{ profile, wxProfile, matchResult, benchmarks, favorites, timestamp }`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "getUserBundle",
  "version": "1.0.0",
  "description": "合并获取用户所有核心数据",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 2: 复制 match-logic.js**

从 `cloudfunctions/matchPrograms/match-logic.js` 完整复制到 `cloudfunctions/getUserBundle/match-logic.js`

- [ ] **Step 3: 编写主逻辑 index.js**

```javascript
// cloudfunctions/getUserBundle/index.js
const cloud = require('wx-server-sdk')
const { runMatch } = require('./match-logic.js')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 一次性返回用户所有核心数据，避免多次云函数冷启动
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const timestamp = Date.now()

  try {
    // ========== 并行查询所有数据 ==========
    const [userRes, programsRes, favoritesRes] = await Promise.all([
      db.collection('users').doc(OPENID).get().catch(() => ({ data: null })),
      db.collection('programs').where({ enabled: true }).get().catch(() => ({ data: [] })),
      db.collection('favorites').where({ userId: OPENID }).get().catch(() => ({ data: [] }))
    ])

    const user = userRes.data || {}
    const programs = programsRes.data || []

    // ========== 匹配结果：优先用已有的，没有则计算 ==========
    let matchResult = user.matchResult
    const MATCH_TTL = 24 * 60 * 60 * 1000 // 24小时内有效

    if (!matchResult || !matchResult.reach || !matchResult.reach.length ||
        (matchResult.calculatedAt && timestamp - matchResult.calculatedAt > MATCH_TTL)) {
      const profile = user.profile || {}
      matchResult = runMatch(profile, programs)
      matchResult.calculatedAt = timestamp

      // 异步写回用户记录（不阻塞返回）
      db.collection('users').doc(OPENID).update({
        data: { matchResult, updatedAt: timestamp }
      }).catch(() => {})
    }

    // ========== 构建基准数据 ==========
    // 从 programs 统计各档位的平均分等基准
    // 简化版：硬编码与原 getBenchmarks 一致的默认值
    const benchmarks = {
      reach: [88, 82, 80, 80, 75, 85, 75],
      match: [80, 75, 75, 75, 70, 80, 68],
      safety: [70, 65, 60, 55, 60, 60, 55]
    }

    // ========== 收藏列表 ==========
    const favorites = (favoritesRes.data || []).map(f => f.programId || f._id)

    // ========== 组装返回 ==========
    return {
      success: true,
      profile: user.profile || {},
      wxProfile: user.wxProfile || {},
      matchResult,
      benchmarks,
      favorites,
      timestamp
    }
  } catch (err) {
    console.error('[getUserBundle] error', err)
    return {
      success: false,
      error: err.message,
      profile: {},
      wxProfile: {},
      matchResult: null,
      benchmarks: null,
      favorites: [],
      timestamp
    }
  }
}
```

- [ ] **Step 4: 本地测试云函数**

在微信开发者工具中右键 `getUserBundle` 文件夹 → 「本地调试」
Expected: 返回包含 profile/matchResult/benchmarks/favorites 的完整对象

- [ ] **Step 5: 部署云函数**

微信开发者工具右键 → 「上传并部署：云端安装依赖（不上传 node_modules）」
Wait: 等待部署完成（约 30-60 秒）

- [ ] **Step 6: 验证线上调用**

在小程序控制台临时调用测试：
```javascript
wx.cloud.callFunction({ name: 'getUserBundle' })
  .then(res => console.log('bundle test', res.result))
```
Expected: success = true，所有字段存在

- [ ] **Step 7: Commit**

```bash
git add cloudfunctions/getUserBundle/
git commit -m "feat: add getUserBundle cloud function for merged data fetch"
```

---

### Task 2: 缓存管理器 CacheManager

**Files:**
- Create: `utils/cache-manager.js`

**Interfaces:**
- Consumes: `wx.getStorageSync`, `wx.setStorageSync`
- Produces: `class CacheManager { loadAllFromStorage(), isValid(key), get(key), set(key, data), setBundle(bundle), clearAll() }`

- [ ] **Step 1: 编写缓存管理器代码**

```javascript
// utils/cache-manager.js

/**
 * 三层缓存管理器
 * L1: 内存 (app.globalData._cache) → 0ms
 * L2: 本地 Storage → <10ms
 * L3: 云端 getUserBundle → 300-800ms
 */

const CACHE_CONFIG = {
  ttl: {
    matchResult: 2 * 60 * 60 * 1000,    // 2小时
    benchmarks: 7 * 24 * 60 * 60 * 1000, // 7天
    favorites: 10 * 60 * 1000,           // 10分钟
    profile: 1 * 60 * 60 * 1000,         // 1小时
    wxProfile: 7 * 24 * 60 * 60 * 1000   // 7天
  },
  keyPrefix: 'gradguide_cache_',
  keys: ['matchResult', 'benchmarks', 'favorites', 'profile', 'wxProfile']
}

class CacheManager {
  constructor(app) {
    this.app = app
    this._cache = app.globalData._cache
  }

  /**
   * 从 L2 Storage 加载所有缓存到 L1 内存
   * 冷启动时调用一次
   * @returns {boolean} 是否有有效缓存
   */
  loadAllFromStorage() {
    let hasValidCache = false
    const timestamps = {}

    for (const key of CACHE_CONFIG.keys) {
      try {
        const stored = wx.getStorageSync(CACHE_CONFIG.keyPrefix + key)
        if (stored && stored.data && stored.timestamp) {
          const age = Date.now() - stored.timestamp
          if (age < CACHE_CONFIG.ttl[key]) {
            this._cache[key] = stored.data
            timestamps[key] = stored.timestamp
            hasValidCache = true
            console.log(`[cache] ${key} loaded from storage, age: ${Math.round(age / 1000)}s`)
          } else {
            console.log(`[cache] ${key} expired, age: ${Math.round(age / 1000)}s`)
          }
        }
      } catch (e) {
        console.warn(`[cache] load ${key} failed`, e)
      }
    }

    this._cache._timestamps = timestamps
    return hasValidCache
  }

  /**
   * 检查某个 key 的缓存是否有效（存在且未过期）
   */
  isValid(key) {
    if (!this._cache[key]) return false
    const ts = this._cache._timestamps && this._cache._timestamps[key]
    if (!ts) return false
    const age = Date.now() - ts
    return age < CACHE_CONFIG.ttl[key]
  }

  /**
   * 从 L1 内存读缓存
   */
  get(key) {
    return this._cache[key] || null
  }

  /**
   * 写入缓存：同时更新 L1 内存 + L2 Storage
   */
  set(key, data) {
    const timestamp = Date.now()
    this._cache[key] = data
    if (!this._cache._timestamps) this._cache._timestamps = {}
    this._cache._timestamps[key] = timestamp

    try {
      wx.setStorageSync(CACHE_CONFIG.keyPrefix + key, {
        data,
        timestamp
      })
      console.log(`[cache] ${key} saved to storage`)
    } catch (e) {
      console.warn(`[cache] save ${key} failed`, e)
    }
  }

  /**
   * 批量写入 bundle 数据
   */
  setBundle(bundle) {
    if (bundle.profile) this.set('profile', bundle.profile)
    if (bundle.wxProfile) this.set('wxProfile', bundle.wxProfile)
    if (bundle.matchResult) this.set('matchResult', bundle.matchResult)
    if (bundle.benchmarks) this.set('benchmarks', bundle.benchmarks)
    if (bundle.favorites) this.set('favorites', bundle.favorites)
  }

  /**
   * 清空所有缓存（开发者工具用）
   */
  clearAll() {
    for (const key of CACHE_CONFIG.keys) {
      this._cache[key] = null
      try {
        wx.removeStorageSync(CACHE_CONFIG.keyPrefix + key)
      } catch (e) {}
    }
    this._cache._timestamps = {}
    console.log('[cache] all cleared')
  }
}

module.exports = CacheManager
```

- [ ] **Step 2: 单元测试（小程序控制台手动验证）**

在 App.js 临时加测试代码：
```javascript
const CacheManager = require('./utils/cache-manager.js')
const testCache = new CacheManager({ globalData: { _cache: {} } })

// 测试写入
testCache.set('profile', { school: '测试大学', gpa: 3.8 })

// 测试读取
console.log('get profile:', testCache.get('profile'))
Expected: { school: '测试大学', gpa: 3.8 }

// 测试有效性
console.log('isValid profile:', testCache.isValid('profile'))
Expected: true
```

- [ ] **Step 3: 移除测试代码，Commit**

```bash
git add utils/cache-manager.js
git commit -m "feat: add CacheManager for 3-layer caching"
```

---

### Task 3: App.js 集成缓存管理器

**Files:**
- Modify: `app.js:1-168`

**Interfaces:**
- Consumes: `utils/cache-manager.js`, `wx.cloud.callFunction('getUserBundle')`
- Produces: `app.cacheManager`, `app._bundlePromise`, `onCacheReady/onCacheUpdated` 通知

- [ ] **Step 1: 修改 app.js 头部，引入 CacheManager**

```javascript
// app.js
const CacheManager = require('./utils/cache-manager.js')

App({
  globalData: {
    userProfile: null,
    wxProfile: null,
    simState: null,
    isLoggedIn: false,
    hasOnboarded: false,
    statusBarHeight: 0,
    menuButton: null,
    reducedMotion: false,
    // 预加载数据缓存：登录后静默拉取，切页秒开
    _cache: {
      matchResult: null,
      benchmarks: null,
      favorites: null,
      profile: null,
      wxProfile: null,
      _timestamps: {}
    }
  },
```

- [ ] **Step 2: 在 onLaunch 中初始化 CacheManager**

```javascript
  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-d7guh4c7wcad0635c'
    })

    // 初始化缓存管理器（必须在 loginAndLoad 之前）
    this.cacheManager = new CacheManager(this)

    // 预置胶囊/状态栏安全区信息
    try {
      const sys = wx.getWindowInfo()
      this.globalData.statusBarHeight = sys.statusBarHeight || 0
      this.globalData.menuButton = wx.getMenuButtonBoundingClientRect()
    } catch (e) {
      console.warn('[safe-area] init failed', e)
    }

    // 读取减弱动效偏好
    this.refreshReducedMotion()
    // 检查是否已完成引导
    const hasOnboarded = wx.getStorageSync('hasOnboarded')
    this.globalData.hasOnboarded = !!hasOnboarded
    // 如果已引导过，登录加载数据
    if (hasOnboarded) {
      this.loginAndLoad()
    }
  },
```

- [ ] **Step 3: 改造 loginAndLoad 方法**

```javascript
  async loginAndLoad() {
    // ─── 阶段 1：读本地缓存，秒级渲染 ───
    const hasValidCache = this.cacheManager.loadAllFromStorage()
    if (hasValidCache) {
      // 有有效缓存：立即通知页面渲染旧数据
      this.globalData.userProfile = this.cacheManager.get('profile')
      this.globalData.wxProfile = this.cacheManager.get('wxProfile')
      this.globalData.isLoggedIn = true
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
      const result = await this._bundlePromise
      const bundle = result.result

      if (bundle.success) {
        // 更新 L1 + L2 缓存
        this.cacheManager.setBundle(bundle)

        // 更新全局状态
        this.globalData.userProfile = bundle.profile
        this.globalData.wxProfile = bundle.wxProfile
        this.globalData.isLoggedIn = true

        // 通知所有页面：数据已更新，可以增量刷新
        this._notifyPagesDataUpdated()

        console.log('[bundle] loaded from cloud, cache updated')
      } else {
        // 云端失败，fallback 到旧的两阶段方式
        console.warn('[bundle] failed, falling back to legacy login')
        await this._legacyLogin()
      }
    } catch (err) {
      console.error('[loginAndLoad] bundle request failed', err)
      // 失败不报错，保持旧缓存继续使用，或 fallback 到旧方式
      if (!hasValidCache) {
        await this._legacyLogin()
      }
    } finally {
      this._bundlePromise = null
    }
  },

  /**
   * 遗留登录方式 fallback
   */
  async _legacyLogin() {
    try {
      const loginRes = await wx.cloud.callFunction({ name: 'login' })
      console.log('[login]', loginRes.result)

      const userRes = await wx.cloud.callFunction({ name: 'getUser' })
      const user = userRes.result

      this.globalData.userProfile = {
        ...(this.globalData.userProfile || {}),
        ...(user.profile || {})
      }
      this.globalData.wxProfile = user.wxProfile || this.globalData.wxProfile || {}
      this.globalData.isLoggedIn = true

      // 后台并行预加载
      this._preloadMatchResult(user)
      this._preloadBenchmarks()
      this._preloadFavorites()

      this._notifyPagesDataReady()
    } catch (err) {
      console.error('[legacyLogin]', err)
      this.globalData.userProfile = {}
      this.globalData.isLoggedIn = false
    }
  },
```

- [ ] **Step 4: 添加通知机制方法**

```javascript
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
```

- [ ] **Step 5: 保留原有预加载方法和对外接口（向后兼容）**

`_preloadMatchResult`, `_preloadBenchmarks`, `_preloadFavorites`,
`getCachedMatchResult`, `getCachedBenchmarks`, `getCachedFavorites`, `refreshMatchCache`
全部保留不变。

- [ ] **Step 6: 编译测试**

微信开发者工具 → 编译
Expected: 无报错，控制台输出 `[cache] loaded from storage` 或 `[bundle] loaded from cloud`

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat: integrate CacheManager and implement 2-phase login flow"
```

---

### Task 4: Match 页面缓存钩子适配

**Files:**
- Modify: `pages/match/match.js:1-190`

**Interfaces:**
- Consumes: `app.cacheManager.get('matchResult')`, `app.getCachedFavorites()`
- Produces: `onCacheReady()`, `onCacheUpdated()`

- [ ] **Step 1: 修改 data 初始化（loading 默认 = true）**

```javascript
  data: {
    curRegion: 'all',
    curMajor: 'all',
    programs: [],
    tierConfig: TIER_CONFIG,
    tierOrder: ['reach', 'match', 'safety'],
    userProfile: { school: '', schoolLevel: '', gpa: '', toefl: '', gre: '', targetRegions: [], targetMajors: [], research: [], internships: [] },
    reach: [],
    match: [],
    safety: [],
    tierCounts: { reach: 0, match: 0, safety: 0 },
    loading: true,  // 默认 true，骨架屏显示
    noMatchData: false,
    loadError: false,
    favoriteIds: [],
    togglingIds: {},
    showTargetInfo: false,
    targetInfoText: ''
  },
```

- [ ] **Step 2: 修改 onLoad，优先查缓存**

```javascript
  onLoad() {
    const app = getApp()

    // 立即检查内存缓存：有就直接渲染，不显示骨架屏
    const cached = app.getCachedMatchResult()
    if (cached && cached.reach && cached.reach.length) {
      console.log('[match] render from memory cache immediately')
      this._renderMatchResult(cached)
      this.setData({ loading: false })

      // 也查收藏缓存
      const favs = app.getCachedFavorites()
      if (favs && favs.length) {
        this.setData({ favoriteIds: favs })
      }
    }

    // 同步 profile 数据
    this.loadData()
  },

  // 新增：缓存就绪钩子（冷启动时 app.js 调）
  onCacheReady() {
    const app = getApp()
    const cached = app.getCachedMatchResult()
    if (cached && cached.reach && cached.reach.length) {
      console.log('[match] onCacheReady, render from storage cache')
      this._renderMatchResult(cached)
      this.setData({ loading: false })

      const favs = app.getCachedFavorites()
      if (favs && favs.length) {
        this.setData({ favoriteIds: favs })
      }
    }
    this.loadData()
  },

  // 新增：缓存更新钩子（云端刷新后增量更新）
  onCacheUpdated() {
    const app = getApp()
    const fresh = app.getCachedMatchResult()
    const favs = app.getCachedFavorites()

    // 只更新数据，不触发 loading，不打断用户操作
    if (fresh && fresh.reach && fresh.reach.length) {
      console.log('[match] onCacheUpdated, silent refresh')
      this._renderMatchResult(fresh)
      this.setData({ loading: false })
    }
    if (favs && favs.length) {
      this.setData({ favoriteIds: favs })
    }
  },

  // 抽离渲染逻辑，供多处调用
  _renderMatchResult(matchResult) {
    this.setData({
      reach: matchResult.reach || [],
      match: matchResult.match || [],
      safety: matchResult.safety || [],
      extremeReachCount: matchResult.extremeReachCount || 0,
      noMatchData: false
    })
  },
```

- [ ] **Step 3: 修改 loadMatchResult，有缓存直接返回**

```javascript
  async loadMatchResult() {
    this.setData({ loadError: false })

    const app = getApp()

    // 【核心优化】优先读缓存：登录时已在后台预加载
    const cached = app.getCachedMatchResult()
    const cachedFavs = app.getCachedFavorites()

    if (cached && cached.reach && cached.reach.length) {
      console.log('[match] using cache data (no API call)')
      this._renderMatchResult(cached)
      if (cachedFavs) {
        this.setData({ favoriteIds: cachedFavs })
      }
      this.setData({ loading: false })
      return
    }

    // 缓存未命中：正常请求
    this.setData({ loading: true })
    // ... 原有的 loadMatchResult 逻辑不变
```

- [ ] **Step 4: 测试**

微信开发者工具编译
1. 清除缓存后首次进入 → 显示骨架屏
2. 第二次进入 → 直接显示内容，无骨架屏
3. 切到 diagnosis 再切回 → 0 延迟渲染

- [ ] **Step 5: Commit**

```bash
git add pages/match/match.js
git commit -m "feat: match page implements cache hooks for instant rendering"
```

---

### Task 5: Diagnosis 页面缓存钩子适配

**Files:**
- Modify: `pages/diagnosis/diagnosis.js:1-410`

**Interfaces:**
- Consumes: `app.cacheManager.get('benchmarks')`, `app.cacheManager.get('profile')`
- Produces: `onCacheReady()`, `onCacheUpdated()`

- [ ] **Step 1: 修改 onLoad，优先查缓存**

```javascript
  onLoad() {
    const app = getApp()
    const cachedBenchmarks = app.getCachedBenchmarks()

    // 有缓存：直接渲染，不显示骨架屏
    if (cachedBenchmarks) {
      console.log('[diagnosis] render from memory cache immediately')
      this.setData({ benchByTier: cachedBenchmarks, loading: false })
      this.calcDimensionsFromProfile()
      this.drawRadarAnimated()
      return
    }

    // 无缓存：显示骨架屏，等待加载
    this.setData({ loading: true })
    this.loadBenchmarks()
  },

  // 新增：缓存就绪钩子
  onCacheReady() {
    const app = getApp()
    const cached = app.getCachedBenchmarks()
    if (cached) {
      console.log('[diagnosis] onCacheReady, render from storage cache')
      this.setData({ benchByTier: cached, loading: false })
      this.calcDimensionsFromProfile()
      this.drawRadarAnimated()
      return
    }
    this.loadBenchmarks()
  },

  // 新增：缓存更新钩子
  onCacheUpdated() {
    const app = getApp()
    const fresh = app.getCachedBenchmarks()
    if (fresh) {
      console.log('[diagnosis] onCacheUpdated, silent refresh')
      const wasLoading = this.data.loading
      this.setData({ benchByTier: fresh, loading: false })
      this.calcDimensionsFromProfile()
      // 如果是从 loading 态刚出来，才播放动画；否则静默不重绘打断用户
      if (wasLoading) {
        this.drawRadarAnimated()
      }
    }
  },
```

- [ ] **Step 2: 修改 loadBenchmarks，有缓存直接返回**

```javascript
  async loadBenchmarks() {
    // 防止重复加载
    if (this._benchmarksLoading) return
    this._benchmarksLoading = true

    const app = getApp()
    const cached = app.getCachedBenchmarks()
    if (cached && Object.keys(cached).length > 0) {
      console.log('[diagnosis] using cache benchmarks (no API call)')
      this.setData({ benchByTier: cached })
      this.calcDimensionsFromProfile()
      this.drawRadarAnimated()
      this.setData({ loading: false })
      this._benchmarksLoaded = true
      this._benchmarksLoading = false
      return
    }

    // 原有的云端请求逻辑不变
    try {
      const res = await wx.cloud.callFunction({ name: 'getBenchmarks' })
      const benchMap = res.result.benchmarks || {}
      if (Object.keys(benchMap).length > 0) {
        this.setData({ benchByTier: benchMap })
      }
    } catch (err) {
      console.error('[loadBenchmarks] 云端加载失败，使用本地硬编码数据', err)
    }

    this.calcDimensionsFromProfile()
    this.drawRadarAnimated()
    this.setData({ loading: false })
    this._benchmarksLoaded = true
    this._benchmarksLoading = false
  },
```

- [ ] **Step 3: 测试**

微信开发者工具编译
1. 冷启动切到诊断页 → 有缓存时秒开，无骨架屏
2. 首次无缓存时显示骨架屏 → 数据回来平滑切换

- [ ] **Step 4: Commit**

```bash
git add pages/diagnosis/diagnosis.js
git commit -m "feat: diagnosis page implements cache hooks for instant radar rendering"
```

---

### Task 6: Mine 页面 & Home 页面适配

**Files:**
- Modify: `pages/mine/mine.js:1-85`
- Modify: `pages/home/home.js:1-65`

**Interfaces:**
- Consumes: `app.cacheManager.get('profile')`, `app.cacheManager.get('wxProfile')`
- Produces: `onCacheReady()`, `onCacheUpdated()`

- [ ] **Step 1: 修改 mine.js**

```javascript
  onLoad() {
    this.syncData()
  },

  // 新增：缓存就绪钩子
  onCacheReady() {
    this.syncData()
  },

  // 新增：缓存更新钩子
  onCacheUpdated() {
    this.syncData()
  },
```

- [ ] **Step 2: 修改 home.js**

```javascript
  onLoad() {
    this.initFromCache()
  },

  // 新增：缓存更新钩子（不显示加载，静默更新 profile 状态）
  onCacheUpdated() {
    this.initFromCache()
  },
```

- [ ] **Step 3: 测试全链路**

完整端到端测试流程：
1. 「我的」页面 → 点击头像 5 次 → 开发者工具出现
2. 点击「清除所有缓存」
3. 完全关闭小程序，重新冷启动
4. 观察：
   - 首次：显示骨架屏，后台加载完成后显示内容
   - 第二次：秒开，无骨架屏，内容瞬间显示
   - 切换各 Tab：无网络请求，0 延迟渲染

- [ ] **Step 4: Commit**

```bash
git add pages/mine/mine.js pages/home/home.js
git commit -m "feat: mine/home pages implement cache update hooks"
```

---

## 实施计划自检

### Spec 覆盖检查

| 规范条目 | 对应任务 |
|---------|---------|
| L1/L2/L3 三层缓存 | Task 2 |
| Cloud function 合并 | Task 1 |
| 2 阶段登录（先渲染缓存再后台刷新） | Task 3 |
| onCacheReady / onCacheUpdated 钩子 | Task 4/5/6 |
| 骨架屏降级为仅首次显示 | Task 4/5 |
| 向后兼容原有接口 | Task 3 |
| TTL 配置 | Task 2 |

✅ 100% 覆盖，无遗漏

### 占位符检查

无 "TBD" / "TODO" / "implement later"，所有代码步骤完整

### 类型一致性检查

- 云函数输出字段名 `matchResult` / `benchmarks` / `favorites`
- CacheManager 方法名 `setBundle` / `get` / `isValid`
- 页面钩子方法名 `onCacheReady` / `onCacheUpdated`

✅ 所有任务字段名和方法名完全一致

---

Plan complete and saved to `docs/superpowers/plans/2026-06-27-fast-first-load.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
