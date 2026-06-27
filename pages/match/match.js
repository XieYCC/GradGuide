// pages/match/match.js
const { TIER_CONFIG } = require('../../utils/data');
const { classifyProgram, calcScore, calcTier } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    curRegion: 'all',
    curMajor: 'all',
    programs: [],
    tierConfig: TIER_CONFIG,
    tierOrder: ['reach', 'match', 'safety'],
    userProfile: { school: '', schoolLevel: '', gpa: '', toefl: '', gre: '', targetRegions: [], targetMajors: [], research: [], internships: [] },
    reach: [],
    match: [],
    safety: [],
    tierCounts: { reach: 0, match: 0, safety: 0 },
    loading: true,
    noMatchData: false,  // 初始 false，加载完成后再判断是否真的无数据
    loadError: false,
    favoriteIds: [],
    togglingIds: {},
    showTargetInfo: false,
    targetInfoText: ''
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    // 已有匹配数据则不重算(避免切 tab 反复触发 matchPrograms 计算)
    const has = this.data.reach.length || this.data.match.length || this.data.safety.length;
    if (has && !this.data.loadError) return;
    this.loadData();
  },

  async onPullDownRefresh() {
    await this.loadMatchResult();
    wx.stopPullDownRefresh();
  },

  loadData() {
    const profile = app.globalData.userProfile || {};
    const targetRegions = profile.targetRegions || [];
    const targetMajors = profile.targetMajors || [];
    const regionText = targetRegions.join('/');
    const majorText = targetMajors.join('/');
    const showTargetInfo = !!(profile.schoolLevel || profile.gpa || targetRegions.length);
    const targetInfoText = [regionText, majorText].filter(Boolean).join(' · ');
    this.setData({ userProfile: profile, showTargetInfo, targetInfoText });

    // Try to read matchResult from cloud
    this.loadMatchResult();
  },

  async loadMatchResult() {
    this.setData({ loadError: false });

    // ==============================================
    // 【核心优化】优先读缓存：登录时已在后台预加载
    // ==============================================
    const app = getApp();
    const cached = app.getCachedMatchResult();
    const cachedFavs = app.getCachedFavorites();

    if (cached && cached.reach) {
      console.log('[match] using cache data (no API call)');
      this.setData({
        reach: cached.reach || [],
        match: cached.match || [],
        safety: cached.safety || [],
        extremeReachCount: cached.extremeReachCount || 0,
        loading: false,
        noMatchData: false
      });
      // 收藏列表也读缓存（如果有）
      if (cachedFavs) {
        this.setData({ favoriteIds: cachedFavs.map(p => p._id) });
      } else {
        this.loadFavorites();
      }
      return;
    }

    // 缓存未命中：正常请求
    this.setData({ loading: true });
    try {
      const matchRes = await wx.cloud.callFunction({ name: 'getUser' });
      const match = matchRes.result?.matchResult;

      if (match && match.reach && match.reach.length + match.match.length + match.safety.length > 0) {
        this.setData({
          reach: match.reach || [],
          match: match.match || [],
          safety: match.safety || [],
          extremeReachCount: match.extremeReachCount || 0,
          loading: false,
          noMatchData: false,
          loadError: false
        });
        this.loadFavorites();
        return;
      }

      // No matchResult yet — trigger calculation
      wx.showLoading({ title: '正在为您匹配...' });
      const calcRes = await wx.cloud.callFunction({ name: 'matchPrograms' });
      this.setData({
        reach: calcRes.result.reach || [],
        match: calcRes.result.match || [],
        safety: calcRes.result.safety || [],
        extremeReachCount: calcRes.result.extremeReachCount || 0,
        loading: false,
        noMatchData: false,
        loadError: false
      });
      wx.hideLoading();
      this.loadFavorites();
    } catch (err) {
      console.error('[match] failed to load match result', err);
      wx.hideLoading();
      this.loadProgramsFallback();
    }
  },

  async loadProgramsFallback() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPrograms',
        data: { region: this.data.curRegion, major: this.data.curMajor }
      });
      let programs = res.result.list || [];
      if (!programs.length) {
        const { PROGRAMS } = require('../../utils/data');
        programs = PROGRAMS;
      }
      const profile = this.data.userProfile || {};
      programs = programs.map(p => ({ ...p, tier: classifyProgram(p, profile) }));
      const reach = programs.filter(p => p.tier === 'reach');
      const match = programs.filter(p => p.tier === 'match');
      const safety = programs.filter(p => p.tier === 'safety');
      const tierCounts = { reach: reach.length, match: match.length, safety: safety.length };
      this.setData({ reach, match, safety, tierCounts, loading: false, noMatchData: false, loadError: false });
      this.loadFavorites();
    } catch (err) {
      console.error('[match] fallback failed', err);
      // 彻底失败:显示重试空态，而非误导用户去填信息
      this.setData({ loading: false, loadError: true });
    }
  },

  async loadFavorites() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getFavorites' });
      const list = res.result.list || [];
      this.setData({ favoriteIds: list.map(p => p._id) });
    } catch (err) {
      console.error('[loadFavorites]', err);
    }
  },

  async toggleFavorite(e) {
    const pid = e.currentTarget.dataset.id;
    if (this.data.togglingIds[pid]) return;
    const isFav = this.data.favoriteIds.includes(pid);
    this.setData({ [`togglingIds.${pid}`]: true });
    try {
      if (isFav) {
        await wx.cloud.callFunction({ name: 'removeFavorite', data: { programId: pid } });
        const idx = this.data.favoriteIds.indexOf(pid);
        if (idx > -1) {
          const newIds = [...this.data.favoriteIds];
          newIds.splice(idx, 1);
          this.setData({ favoriteIds: newIds });
        }
        wx.showToast({ title: '已取消收藏', icon: 'none' });
      } else {
        await wx.cloud.callFunction({ name: 'addFavorite', data: { programId: pid } });
        this.setData({ favoriteIds: [...this.data.favoriteIds, pid] });
        wx.showToast({ title: '已收藏', icon: 'success' });
      }
    } catch (err) {
      console.error('[toggleFavorite]', err);
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
    this.setData({ [`togglingIds.${pid}`]: false });
  },

  filterRegion(e) {
    const region = e.currentTarget.dataset.filter || 'all';
    this.setData({ curRegion: region });
    this.loadProgramsFallback();
  },

  filterMajor(e) {
    const major = e.currentTarget.dataset.major || 'all';
    this.setData({ curMajor: major });
    this.loadProgramsFallback();
  },

  goToDiagnosis() {
    wx.switchTab({ url: '/pages/diagnosis/diagnosis' });
  },

  goToSimulator() {
    wx.navigateTo({ url: '/pages/simulator/simulator' });
  },

  goToProfile() {
    wx.navigateTo({ url: '/pages/profile/step1-school/step1-school' });
  }
});
