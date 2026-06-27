const app = getApp()

Page({
  data: {
    schoolLevels: ['985 · C9 联盟', '985', '211', '双一流', '海外本科', '中外合办', '双非一本', '双非二本'],
    selected: ''
  },

  onLoad() {
    const profile = app.globalData.userProfile || {}
    this.setData({ selected: profile.schoolLevel || '' })
  },

  onSelect(e) {
    this.setData({ selected: e.currentTarget.dataset.value })
  },

  async onNext() {
    if (!this.data.selected) {
      wx.showToast({ title: '请选择学校层次', icon: 'none' })
      return
    }
    const school = this.data.selected.replace(/ ·.*$/, '')
    app.globalData.userProfile = { ...app.globalData.userProfile, schoolLevel: this.data.selected, school }
    // 同步持久化 schoolLevel 与 school，避免本地有 school 而云端缺失
    try {
      await wx.cloud.callFunction({
        name: 'saveProfile',
        data: { profile: { schoolLevel: this.data.selected, school } }
      })
    } catch (err) {
      console.error('[saveProfile]', err)
    }
    wx.navigateTo({ url: '/pages/profile/step2-grad/step2-grad' })
  }
})
