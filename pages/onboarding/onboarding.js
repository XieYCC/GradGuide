const app = getApp()

Page({
  data: {
    curSlide: 0,
    selectedMajor: 'CS',
    gpa: 3.4,
    slides: [1, 2, 3, 4],
    inputFocus: false
  },

  onLoad(options) {
    if (options && options.rewatch) {
      app.loginAndLoad()
      return
    }
    if (app.globalData.hasOnboarded) {
      wx.switchTab({ url: '/pages/home/home' })
      return
    }
    app.loginAndLoad()
  },

  onSlideChange(e) {
    this.setData({ curSlide: e.detail.current })
  },

  selectMajor(e) {
    this.setData({ selectedMajor: e.currentTarget.dataset.major })
  },

  onGpaInput(e) {
    this.gpaValue = e.detail.value
  },

  onInputFocus() {
    this.setData({ inputFocus: true })
  },

  onInputBlur() {
    this.setData({ inputFocus: false })
  },

  onStart() {
    wx.setStorageSync('hasOnboarded', true)
    app.globalData.hasOnboarded = true
    wx.navigateTo({ url: '/pages/profile/init/init' })
  },

  onSkip() {
    wx.setStorageSync('hasOnboarded', true)
    app.globalData.hasOnboarded = true
    wx.switchTab({ url: '/pages/home/home' })
  }
})
