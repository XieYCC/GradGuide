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

  // 登录就绪回调队列：页面加载时如果 isLoggedIn=false，注册回调等待通知
  _loginCallbacks: [],

  refreshReducedMotion() {
    this.globalData.reducedMotion = !!wx.getStorageSync('reducedMotion')
    return this.globalData.reducedMotion
  },

  setReducedMotion(on) {
    this.globalData.reducedMotion = !!on
    wx.setStorageSync('reducedMotion', !!on)
  },

  onLaunch() {
    wx.cloud.init({ env: 'cloud1-d7guh4c7wcad0635c' })

    // 初始化缓存管理器
    this.cacheManager = new CacheManager(this)

    try {
      const sys = wx.getWindowInfo()
      this.globalData.statusBarHeight = sys.statusBarHeight || 0
      this.globalData.menuButton = wx.getMenuButtonBoundingClientRect()
    } catch (e) {
      console.warn('[safe-area] init failed', e)
    }

    this.refreshReducedMotion()

    const hasOnboarded = wx.getStorageSync('hasOnboarded')
    this.globalData.hasOnboarded = !!hasOnboarded
    if (hasOnboarded) {
      this.loginAndLoad()
    }
  },

  async loginAndLoad() {
    // 先尝试 getUserBundle（合并接口），3 秒超时快速 fallback
    try {
      const result = await Promise.race([
        wx.cloud.callFunction({ name: 'getUserBundle' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ])
      const bundle = result.result
      if (bundle && bundle.success) {
        this.cacheManager.setBundle(bundle)
        this.globalData.userProfile = bundle.profile
        this.globalData.wxProfile = bundle.wxProfile
        this.globalData.isLoggedIn = true
        this._notifyPagesReady()
        console.log('[bundle] loaded from cloud')
        return
      }
    } catch (e) {
      console.warn('[loginAndLoad] getUserBundle failed/timeout, fallback to legacy:', e.message)
    }

    // fallback：走 legacy 登录（login + getUser，已部署，必成功）
    await this._legacyLogin()
  },

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
      console.log('[getUser] profile loaded')

      // 等待关键预加载完成，再通知页面（确保回调触发时缓存已就绪）
      await Promise.all([
        this._preloadMatchResult(user),
        this._preloadBenchmarks()
      ])
      this._preloadFavorites()  // 收藏不重要，后台静默

      // 通知页面：此时缓存一定有数据
      this._notifyPagesReady()
    } catch (err) {
      console.error('[legacyLogin]', err)
      this.globalData.userProfile = {}
      this.globalData.isLoggedIn = false
    }
  },

  async _preloadMatchResult(user) {
    try {
      if (user && user.matchResult && user.matchResult.reach) {
        this.cacheManager.set('matchResult', user.matchResult)
        console.log('[preload] matchResult from user record')
        return
      }
      const res = await wx.cloud.callFunction({ name: 'matchPrograms' })
      this.cacheManager.set('matchResult', res.result)
      console.log('[preload] matchResult calculated')
    } catch (err) {
      console.warn('[preload] matchResult failed', err)
    }
  },

  async _preloadBenchmarks() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getBenchmarks' })
      this.cacheManager.set('benchmarks', res.result.benchmarks || {})
      console.log('[preload] benchmarks loaded')
    } catch (err) {
      console.warn('[preload] benchmarks failed', err)
    }
  },

  async _preloadFavorites() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getFavorites' })
      this.cacheManager.set('favorites', res.result.list || [])
      console.log('[preload] favorites loaded')
    } catch (err) {
      console.warn('[preload] favorites failed', err)
    }
  },

  // 通知当前页面 profile 已就绪（login 完成后）
  _notifyPagesReady() {
    // 通知已加载的页面
    const pages = getCurrentPages()
    pages.forEach(page => {
      if (typeof page.onProfileReady === 'function') {
        page.onProfileReady()
      }
    })
    // 通知等待队列中的回调（页面 onLoad 时注册的）
    const cbs = this._loginCallbacks
    this._loginCallbacks = []
    cbs.forEach(cb => cb())
  },

  /**
   * 页面调用：如果登录已完成立即返回 true，否则注册回调等待
   * @param {Function} cb - 登录完成后的回调
   * @returns {boolean} 是否已登录
   */
  waitForLogin(cb) {
    if (this.globalData.isLoggedIn) {
      return true
    }
    this._loginCallbacks.push(cb)
    return false
  },

  // === 对外缓存接口 ===
  getCachedMatchResult() { return this.cacheManager.get('matchResult') },
  getCachedBenchmarks() { return this.cacheManager.get('benchmarks') },
  getCachedFavorites() { return this.cacheManager.get('favorites') },

  // 档案更新后刷新匹配缓存
  async refreshMatchCache() {
    try {
      const res = await wx.cloud.callFunction({ name: 'matchPrograms' })
      this.cacheManager.set('matchResult', res.result)
      return res.result
    } catch (err) {
      console.warn('[refreshMatchCache] failed', err)
      return null
    }
  }
})