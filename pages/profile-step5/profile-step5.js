const app = getApp()

Page({
  data: {
    regions: ['美国', '香港', '英国', '新加坡', '加拿大', '欧洲', '澳大利亚', '混申'],
    majors: ['CS / DS', 'MKT / BA', '金融 / 金工', '教育', '社科', '艺术', '其他'],
    priorities: ['学校排名', '专业排名', '地理位置', '就业率', '学费'],
    selectedRegions: [],
    selectedMajors: [],
    regionOptions: [],
    majorOptions: [],
    priority: ''
  },

  onLoad() {
    const profile = app.globalData.userProfile || {}
    this.setData({
      selectedRegions: profile.targetRegions || [],
      selectedMajors: profile.targetMajors || [],
      priority: profile.priority || ''
    })
    this.refreshOptions()
  },

  refreshOptions() {
    const regionOptions = this.data.regions.map((name, index) => ({
      name,
      index,
      active: this.data.selectedRegions.indexOf(name) > -1
    }))
    const majorOptions = this.data.majors.map((name, index) => ({
      name,
      index,
      active: this.data.selectedMajors.indexOf(name) > -1
    }))
    this.setData({ regionOptions, majorOptions })
  },

  toggleItem(e) {
    const { type, index } = e.currentTarget.dataset
    const key = type === 'region' ? 'selectedRegions' : 'selectedMajors'
    const list = [...this.data[key]]
    const value = type === 'region' ? this.data.regions[index] : this.data.majors[index]
    const idx = list.indexOf(value)
    if (idx > -1) list.splice(idx, 1)
    else list.push(value)
    this.setData({ [key]: list })
    this.refreshOptions()
  },

  onPriorityChange(e) {
    this.setData({ priority: this.data.priorities[e.detail.value] })
  },

  onPrev() { wx.navigateBack() },

  onFinish() {
    const profile = {
      targetRegions: this.data.selectedRegions,
      targetMajors: this.data.selectedMajors,
      priority: this.data.priority
    }
    app.globalData.userProfile = { ...app.globalData.userProfile, ...profile }
    wx.cloud.callFunction({ name: 'saveProfile', data: { profile } }).catch(err => {
      console.error('[saveProfile]', err)
    })
    wx.showToast({ title: '档案保存成功', icon: 'success' })
    setTimeout(() => {
      wx.switchTab({ url: '/pages/home/home' })
    }, 1500)
  }
})
