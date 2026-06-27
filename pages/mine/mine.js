const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    profile: {},
    hasProfile: false,
    wxProfile: {},
    avatarText: '?',
    showDevTools: false,  // 开发者工具开关
    _avatarTapCount: 0     // 头像点击计数器
  },

  onLoad() {
    this.syncData()
  },

  onShow() {
    this.refreshFromCloud()
  },

  onProfileReady() {
    this.syncData()
  },

  // 点击头像解锁开发者工具
  onAvatarTap() {
    this.data._avatarTapCount = (this.data._avatarTapCount || 0) + 1
    console.log('[dev] avatar tap', this.data._avatarTapCount)
    if (this.data._avatarTapCount >= 5) {
      this.setData({ showDevTools: true, _avatarTapCount: 0 })
      wx.showToast({ title: '开发者工具已解锁 🛠️', icon: 'none', duration: 2000 })
    }
  },

  // 模拟新用户体验：清除缓存并重启到引导页
  simulateNewUser() {
    wx.showModal({
      title: '模拟新用户体验',
      content: '将清除本地缓存，重启小程序模拟首次登录。确定吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('hasOnboarded')
          app.cacheManager.clearAll()
          app.globalData.isLoggedIn = false
          wx.showToast({ title: '准备重启...', icon: 'loading', duration: 1500 })
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/onboarding/onboarding' })
          }, 1500)
        }
      }
    })
  },

  // 仅清除缓存：测试骨架屏显示效果
  clearCacheOnly() {
    app.cacheManager.clearAll()
    wx.showToast({ title: '预加载缓存已清空 ✅', icon: 'success' })
    console.log('[dev] 预加载缓存已清空，切换到 match/diagnosis 页面可测试骨架屏显示效果')
  },

  async onPullDownRefresh() {
    await this.refreshFromCloud()
    wx.stopPullDownRefresh()
  },

  async refreshFromCloud() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getUser' })
      const user = res.result
      // 档案与微信资料分离存放
      app.globalData.userProfile = {
        ...(app.globalData.userProfile || {}),
        ...(user.profile || {})
      }
      app.globalData.wxProfile = user.wxProfile || app.globalData.wxProfile || {}
      app.globalData.isLoggedIn = true
    } catch (err) {
      console.error('[mine] getUser failed', err)
    }
    this.syncData()
  },

  syncData() {
    const profile = app.globalData.userProfile || {}
    const wxProfile = app.globalData.wxProfile || {}
    const hasProfile = !!(profile.school || profile.gpa)
    const avatarText = wxProfile.nickName ? wxProfile.nickName.slice(0, 1) : '?'
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      profile,
      hasProfile,
      wxProfile,
      avatarText
    })
  },

  // 点击头像解锁开发者工具（连续点击 5 次）
  onAvatarTap() {
    this.data._avatarTapCount++
    console.log('[dev] avatar tap', this.data._avatarTapCount)
    if (this.data._avatarTapCount >= 5) {
      this.setData({ showDevTools: true, _avatarTapCount: 0 })
      wx.showToast({ title: '开发者工具已解锁 🛠️', icon: 'none', duration: 2000 })
    }
  },

  // 模拟新用户：清除缓存 + 清除 hasOnboarded + 重启
  simulateNewUser() {
    wx.showModal({
      title: '模拟新用户体验',
      content: '将清除本地缓存，重启小程序模拟首次登录。确定吗？',
      success: (res) => {
        if (res.confirm) {
          // 1. 清除本地缓存
          wx.removeStorageSync('hasOnboarded')
          // 2. 清除全局预加载缓存
          app.globalData._cache.matchResult = null
          app.globalData._cache.benchmarks = null
          app.globalData._cache.favorites = null
          // 3. 重置登录状态
          app.globalData.isLoggedIn = false
          // 4. 提示并重启
          wx.showToast({ title: '准备重启...', icon: 'loading', duration: 1500 })
          setTimeout(() => {
            // 小程序冷启动
            wx.reLaunch({ url: '/pages/onboarding/onboarding' })
          }, 1500)
        }
      }
    })
  },

  // 仅清除缓存：测试骨架屏显示
  clearCacheOnly() {
    app.globalData._cache.matchResult = null
    app.globalData._cache.benchmarks = null
    app.globalData._cache.favorites = null
    wx.showToast({ title: '预加载缓存已清空 ✅', icon: 'success' })
    console.log('[dev] 预加载缓存已清空，切换到 match/diagnosis 页面可测试骨架屏')
  },

  goToProfile() {
    wx.navigateTo({ url: '/pages/profile/step1-school/step1-school' })
  },

  goToOnboarding() {
    wx.navigateTo({ url: '/pages/onboarding/onboarding?rewatch=1' })
  },

  goToSimulator() {
    wx.navigateTo({ url: '/pages/simulator/simulator' })
  },

  goToEssay() {
    wx.navigateTo({ url: '/pages/essay/essay' })
  },

  goToMatch() {
    wx.switchTab({ url: '/pages/match/match' })
  },

  goToProfileInit() {
    wx.navigateTo({ url: '/pages/profile/init/init' })
  }
})