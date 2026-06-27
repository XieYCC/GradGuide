const app = getApp()

Page({
  data: {
    gradYears: ['2025（大四在读）', '2026（大三）', '2027（大二）', '已毕业 · 在职'],
    selected: ''
  },

  onLoad() {
    const profile = app.globalData.userProfile || {}
    this.setData({ selected: profile.gradYear || '' })
  },

  onSelect(e) {
    this.setData({ selected: e.currentTarget.dataset.value })
  },

  onPrev() {
    wx.navigateBack()
  },

  async onNext() {
    if (!this.data.selected) {
      wx.showToast({ title: '请选择毕业年份', icon: 'none' })
      return
    }
    app.globalData.userProfile = { ...app.globalData.userProfile, gradYear: this.data.selected }
    try {
      await wx.cloud.callFunction({ name: 'saveProfile', data: { profile: { gradYear: this.data.selected } } })
    } catch (err) {
      console.error('[saveProfile]', err)
    }
    wx.navigateTo({ url: '/pages/profile/step3-scores/step3-scores' })
  }
})
