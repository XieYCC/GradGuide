const app = getApp()

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    canSave: false
  },

  onLoad() {
    const wxProfile = (app.globalData.userProfile && app.globalData.userProfile.wxProfile) || {}
    this.setData({
      avatarUrl: wxProfile.avatarUrl || '',
      nickName: wxProfile.nickName || '',
      canSave: !!wxProfile.nickName
    })
  },

  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl })
  },

  onNickNameInput(e) {
    const nickName = e.detail.value
    this.setData({ nickName, canSave: !!nickName })
  },

  async onSave() {
    if (!this.data.nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    try {
      if (!app.globalData.isLoggedIn) {
        await app.loginAndLoad()
      }

      const wxProfile = {
        avatarUrl: this.data.avatarUrl,
        nickName: this.data.nickName
      }

      const res = await wx.cloud.callFunction({
        name: 'saveProfile',
        data: { profile: { wxProfile } }
      })

      if (res.result && res.result.code !== 0) {
        throw new Error(res.result.message || '保存失败')
      }

      app.globalData.userProfile = {
        ...(app.globalData.userProfile || {}),
        wxProfile
      }
      app.globalData.isLoggedIn = true

      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/home' })
      }, 600)
    } catch (err) {
      console.error('[profile-init] save failed', err)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  onSkip() {
    wx.switchTab({ url: '/pages/home/home' })
  }
})
