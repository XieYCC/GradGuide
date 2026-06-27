const app = getApp()

Page({
  data: {
    researchTypes: ['校内导师项目', '知名实验室暑研', '顶会论文', '普刊论文'],
    internTypes: ['大厂(BAT/MAANG)', '独角兽', '外企/咨询', '普通公司'],
    research: [{ name: '', type: '' }],
    internships: [{ name: '', type: '' }]
  },

  onLoad() {
    const profile = app.globalData.userProfile || {}
    this.setData({
      research: profile.research?.length ? profile.research : [{ name: '', type: '' }],
      internships: profile.internships?.length ? profile.internships : [{ name: '', type: '' }]
    })
  },

  onResearchAdd() {
    this.setData({ research: [...this.data.research, { name: '', type: '' }] })
  },

  onInternAdd() {
    this.setData({ internships: [...this.data.internships, { name: '', type: '' }] })
  },

  onInputChange(e) {
    const { section, index, field } = e.currentTarget.dataset
    const key = `${section}[${index}].${field}`
    this.setData({ [key]: e.detail.value })
  },

  onTypeChange(e) {
    const { section, index } = e.currentTarget.dataset
    const val = this.data[section === 'research' ? 'researchTypes' : 'internTypes'][e.detail.value]
    const key = `${section}[${index}].type`
    this.setData({ [key]: val })
  },

  onPrev() { wx.navigateBack() },

  async onNext() {
    const research = this.data.research.filter(r => r.name.trim())
    const internships = this.data.internships.filter(r => r.name.trim())
    app.globalData.userProfile = { ...app.globalData.userProfile, research, internships }
    try {
      await wx.cloud.callFunction({ name: 'saveProfile', data: { profile: { research, internships } } })
    } catch (err) {
      console.error('[saveProfile]', err)
    }
    wx.navigateTo({ url: '/pages/profile/step5-targets/step5-targets' })
  },

  onSkip() {
    wx.navigateTo({ url: '/pages/profile/step5-targets/step5-targets' })
  }
})
