const { calcScore, calcTier } = require('../../utils/util')
const app = getApp()

Page({
  data: {
    selectedMajor: 'CS',
    gpa: '',
    showResult: false,
    score: 0,
    tier: { reach: 0, match: 0, safe: 0 },
    hasProfile: false
  },

  onLoad() {
    this.initFromCache()
  },

  onProfileReady() {
    this.initFromCache()
  },

  initFromCache() {
    const profile = app.globalData.userProfile || {}
    this.setData({
      hasProfile: !!(profile.school || profile.gpa),
      selectedMajor: profile.targetMajors && profile.targetMajors[0] ? profile.targetMajors[0] : 'CS'
    })
  },

  selectMajor(e) {
    this.setData({ selectedMajor: e.currentTarget.dataset.major })
  },

  onGpaInput(e) {
    this.setData({ gpa: e.detail.value })
  },

  onPredict() {
    const gpa = parseFloat(this.data.gpa) || 0
    const state = {
      gpa,
      toefl: 98,
      gre: 0,
      paper: false,
      research: false,
      intern: false,
      award: false
    }
    const score = calcScore(state)
    const baseScore = 73
    const baseTier = { reach: 5, match: 10, safe: 6 }
    const tier = calcTier(score, baseScore, baseTier)
    this.setData({ score, tier, showResult: true })
  },

  goToMatch() {
    wx.switchTab({ url: '/pages/match/match' })
  },

  goToProfile() {
    wx.navigateTo({ url: '/pages/profile/step1-school/step1-school' })
  }
})
