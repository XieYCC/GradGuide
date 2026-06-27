// app.js
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
    reducedMotion: false
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
  }
})
