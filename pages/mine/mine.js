const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    profile: {},
    hasProfile: false,
    wxProfile: {},
    avatarText: '?'
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
