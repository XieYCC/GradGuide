App({
  globalData: {
    userProfile: null,      // 纯档案字段(gpa/toefl/research...),不含微信资料
    wxProfile: null,        // 微信资料(avatarUrl/nickName),与档案分离
    simState: null,
    isLoggedIn: false,
    hasOnboarded: false,
    // 胶囊安全区信息：未来切换 navigationStyle: custom 时各页顶部避让用
    //   customTop = statusBarHeight + 胶囊占位高度(约 menuButton.height + (menuButton.top-statusBarHeight)*2)
    statusBarHeight: 0,
    menuButton: null,
    // 减弱动效偏好(用户在「我的」设置中开关，持久化于 storage)。
    // 小程序无法读取系统 prefers-reduced-motion，故由用户显式控制。
    // 各页面根节点据此绑定 class="reduced-motion" 触发 app.wxss 兜底样式。
    reducedMotion: false,
    // 预加载数据缓存：登录后静默拉取，切页秒开
    _cache: {
      matchResult: null,     // 选校匹配结果
      benchmarks: null,      // 诊断基准数据
      favorites: null        // 收藏列表
    }
  },

  // 读取减弱动效偏好(供页面根节点 class 绑定用)
  refreshReducedMotion() {
    this.globalData.reducedMotion = !!wx.getStorageSync('reducedMotion')
    return this.globalData.reducedMotion
  },

  // 设置减弱动效偏好(「我的」页开关调用)
  setReducedMotion(on) {
    this.globalData.reducedMotion = !!on
    wx.setStorageSync('reducedMotion', !!on)
  },

  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-d7guh4c7wcad0635c'
    })

    // 预置胶囊/状态栏安全区信息（当前用默认导航栏，预留 custom 切换）
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

  async loginAndLoad() {
    try {
      const loginRes = await wx.cloud.callFunction({ name: 'login' })
      console.log('[login]', loginRes.result)

      const userRes = await wx.cloud.callFunction({ name: 'getUser' })
      const user = userRes.result

      // 档案与微信资料分离存放,避免职责耦合
      // userProfile 合并而非覆盖:防止 getUser 旧数据冲掉本地刚编辑的字段
      this.globalData.userProfile = {
        ...(this.globalData.userProfile || {}),
        ...(user.profile || {})
      }
      this.globalData.wxProfile = user.wxProfile || this.globalData.wxProfile || {}
      this.globalData.isLoggedIn = true
      console.log('[getUser] profile loaded')

      // 【核心优化】后台静默预加载：选校匹配 + 诊断基准 + 收藏列表
      // 不 await，不阻塞登录流程，后台并行拉取
      this._preloadMatchResult(user)
      this._preloadBenchmarks()
      this._preloadFavorites()

      // 通知各页面数据已就绪
      const pages = getCurrentPages()
      pages.forEach(page => {
        if (typeof page.onProfileReady === 'function') {
          page.onProfileReady()
        }
      })
    } catch (err) {
      console.error('[loginAndLoad]', err)
      // 降级：用空 profile 继续使用，不阻塞用户
      this.globalData.userProfile = {}
      this.globalData.isLoggedIn = false
    }
  },

  // 预加载选校匹配结果（后台静默）
  async _preloadMatchResult(user) {
    try {
      // 优先读云端已有的 matchResult
      if (user && user.matchResult && user.matchResult.reach) {
        this.globalData._cache.matchResult = user.matchResult
        console.log('[preload] matchResult from user record')
        return
      }
      // 云端没有，触发一次匹配计算
      const res = await wx.cloud.callFunction({ name: 'matchPrograms' })
      this.globalData._cache.matchResult = res.result
      console.log('[preload] matchResult calculated')
    } catch (err) {
      console.warn('[preload] matchResult failed', err)
      // 失败不报错，页面自己会 fallback
    }
  },

  // 预加载诊断基准数据（后台静默）
  async _preloadBenchmarks() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getBenchmarks' })
      this.globalData._cache.benchmarks = res.result.benchmarks || {}
      console.log('[preload] benchmarks loaded')
    } catch (err) {
      console.warn('[preload] benchmarks failed', err)
    }
  },

  // 预加载收藏列表（后台静默）
  async _preloadFavorites() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getFavorites' })
      this.globalData._cache.favorites = res.result.list || []
      console.log('[preload] favorites loaded')
    } catch (err) {
      console.warn('[preload] favorites failed', err)
    }
  },

  // 供页面调用：获取缓存的匹配结果，null = 未就绪
  getCachedMatchResult() {
    return this.globalData._cache.matchResult
  },

  // 供页面调用：获取缓存的基准数据，null = 未就绪
  getCachedBenchmarks() {
    return this.globalData._cache.benchmarks
  },

  // 供页面调用：获取缓存的收藏列表
  getCachedFavorites() {
    return this.globalData._cache.favorites
  },

  // 页面保存档案后，刷新缓存
  async refreshMatchCache() {
    try {
      const res = await wx.cloud.callFunction({ name: 'matchPrograms' })
      this.globalData._cache.matchResult = res.result
      return res.result
    } catch (err) {
      console.warn('[refreshMatchCache] failed', err)
      return null
    }
  }
})
