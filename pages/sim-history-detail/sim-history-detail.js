Page({
  data: {
    detail: null
  },

  onLoad(options) {
    if (options.data) {
      try {
        const detail = JSON.parse(decodeURIComponent(options.data))
        this.setData({ detail })
      } catch (e) {
        console.error('[sim-history-detail] parse failed', e)
      }
    }
  }
})
