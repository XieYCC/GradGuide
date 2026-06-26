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

  onNext() {
    if (!this.data.selected) {
      wx.showToast({ title: '请选择学校层次', icon: 'none' })
      return
    }
    app.globalData.userProfile = { ...app.globalData.userProfile, schoolLevel: this.data.selected, school: this.data.selected.replace(/ ·.*$/, '') }
    wx.cloud.callFunction({ name: 'saveProfile', data: { profile: { schoolLevel: this.data.selected } } }).catch(err => {
      console.error('[saveProfile]', err)
    })
    wx.navigateTo({ url: '/pages/profile-step2/profile-step2' })
  }
})
