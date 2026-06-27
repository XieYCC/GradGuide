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