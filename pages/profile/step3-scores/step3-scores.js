const app = getApp()

Page({
  data: {
    gpa: '3.0',
    gpaScale: '/4.0',
    gpaScales: ['/4.0', '/4.3', '/5.0', '/100'],
    rank: '',
    toefl: '',
    gre: ''
  },

  onLoad() {
    const profile = app.globalData.userProfile || {}
    this.setData({
      gpa: profile.gpa ? String(profile.gpa) : '',
      gpaScale: profile.gpaScale || '/4.0',
      rank: profile.rank || '',
      toefl: profile.toefl ? String(profile.toefl) : '',
      gre: profile.gre ? String(profile.gre) : ''
    })
  },

  onGpaInput(e) {
    this.setData({ gpa: e.detail.value })
  },

  onScaleChange(e) {
    this.setData({ gpaScale: this.data.gpaScales[e.detail.value] })
  },

  onToeflInput(e) {
    this.setData({ toefl: e.detail.value })
  },

  onGreInput(e) {
    this.setData({ gre: e.detail.value })
  },

  onRankInput(e) {
    this.setData({ rank: e.detail.value })
  },

  onPrev() { wx.navigateBack() },

  async onNext() {
    const gpaNum = this.data.gpa === '' ? 0 : parseFloat(this.data.gpa) || 0
    const toeflNum = this.data.toefl === '' ? 0 : parseFloat(this.data.toefl) || 0
    const greNum = this.data.gre === '' ? 0 : parseFloat(this.data.gre) || 0
    app.globalData.userProfile = {
      ...app.globalData.userProfile,
      gpa: gpaNum,
      gpaScale: this.data.gpaScale,
      toefl: toeflNum,
      gre: greNum,
      rank: this.data.rank
    }
    try {
      await wx.cloud.callFunction({
        name: 'saveProfile',
        data: {
          profile: {
            gpa: gpaNum,
            gpaScale: this.data.gpaScale,
            toefl: toeflNum,
            gre: greNum,
            rank: this.data.rank
          }
        }
      })
    } catch (err) {
      console.error('[saveProfile]', err)
    }
    wx.navigateTo({ url: '/pages/profile/step4-experience/step4-experience' })
  }
})
