// pages/match/match.js
const { TIER_CONFIG, REGION_CONFIG, MAJOR_CONFIG } = require('../../utils/data');
const { classifyProgram } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    curRegion: 'all',
    curMajor: 'all',
    programs: [],
    tierConfig: TIER_CONFIG,
    regionConfig: REGION_CONFIG,
    majorConfig: MAJOR_CONFIG,
    tierOrder: ['reach', 'match', 'safety'],
    userProfile: { school: '', schoolLevel: '', gpa: '', toefl: '', gre: '', targetRegions: [], targetMajors: [], research: [], internships: [] },
    reach: [],
    match: [],
    safety: [],
    tierCounts: { reach: 0, match: 0, safety: 0 },
    loading: true,
    noMatchData: false,
    loadError: false,
    favoriteIds: [],
    togglingIds: {},
    showTargetInfo: false,
    targetInfoText: ''
  },

  onLoad() {
    // 如果登录已完成，直接加载；否则注册回调等待登录完成
    if (!app.waitForLogin(() => this._load())) {
      console.log('[match] waiting for login...')
    } else {
      this._load()
    }
  },

  onShow() {
    // 每次切回此页都重新读缓存并渲染（带入场动画）
    if (app.globalData.isLoggedIn) {
      this._load()
    }
  },

  onProfileReady() {
    // app.js 登录完成后回调（兼容，waitForLogin 已覆盖主要场景）
    this._load()
  },

  // === 核心：统一加载入口 ===
  _load() {
    this._updateProfileInfo()

    // 1. 优先读缓存
    const cached = app.getCachedMatchResult()
    if (cached && cached.reach && cached.reach.length) {
      console.log('[match] render from cache')
      this._renderMatchResult(cached)
      this.setData({ loading: false, loadError: false })

      const favs = app.getCachedFavorites()
      if (favs && favs.length) {
        this.setData({ favoriteIds: favs })
      } else {
        this.loadFavorites()
      }
      return
    }

    // 2. 缓存 miss → 调云函数
    if (app.globalData.isLoggedIn) {
      this.loadMatchResult()
    }
    // 否则保持 loading=true，等 onProfileReady 回调
  },

  // === 从云端加载匹配结果 ===
  async loadMatchResult() {
    this.setData({ loading: true, loadError: false });
    try {
      const matchRes = await wx.cloud.callFunction({ name: 'getUser' });
      const match = matchRes.result?.matchResult;

      if (match && match.reach && (match.reach.length + match.match.length + match.safety.length > 0)) {
        // 写入缓存
        app.cacheManager.set('matchResult', match);
        this._renderMatchResult(match);
        this.setData({ loading: false });
        this.loadFavorites();
        return;
      }

      // 没有缓存结果 → 触发匹配计算
      wx.showLoading({ title: '正在为您匹配...' });
      const calcRes = await wx.cloud.callFunction({ name: 'matchPrograms' });
      const result = calcRes.result;
      app.cacheManager.set('matchResult', result);
      this._renderMatchResult(result);
      wx.hideLoading();
      this.setData({ loading: false });
      this.loadFavorites();
    } catch (err) {
      console.error('[match] load failed', err);
      wx.hideLoading();
      this.loadProgramsFallback();
    }
  },

  _renderMatchResult(matchResult) {
    this.setData({
      reach: matchResult.reach || [],
      match: matchResult.match || [],
      safety: matchResult.safety || [],
      extremeReachCount: matchResult.extremeReachCount || 0,
      noMatchData: false
    });
  },

  _updateProfileInfo() {
    const profile = app.globalData.userProfile || {};
    const targetRegions = profile.targetRegions || [];
    const targetMajors = profile.targetMajors || [];
    const showTargetInfo = !!(profile.schoolLevel || profile.gpa || targetRegions.length);
    const targetInfoText = [targetRegions.join('/'), targetMajors.join('/')].filter(Boolean).join(' · ');
    this.setData({ userProfile: profile, showTargetInfo, targetInfoText });
  },

  async onPullDownRefresh() {
    await this.loadMatchResult();
    wx.stopPullDownRefresh();
  },

  async loadProgramsFallback() {
    this.setData({ loading: true });
    try {
      const region = this.data.curRegion;
      const majorGroup = this.data.curMajor;

      // Resolve grouped major codes to individual majors
      const GROUPED_MAJORS = {
        'CS-DS-EE': ['CS', 'DS', 'EE'],
        'MKT-BA-Finance': ['MKT', 'BA', 'Finance']
      };

      // Fetch all programs, filter client-side
      const res = await wx.cloud.callFunction({
        name: 'getPrograms',
        data: { region: 'all', major: 'all' }
      });
      let programs = res.result.list || [];
      if (!programs.length) {
        const { PROGRAMS } = require('../../utils/data');
        programs = PROGRAMS;
      }

      // Client-side region filter
      if (region !== 'all') {
        programs = programs.filter(p => p.country === region);
      }

      // Client-side major group filter
      if (majorGroup !== 'all') {
        if (GROUPED_MAJORS[majorGroup]) {
          const allowed = GROUPED_MAJORS[majorGroup];
          programs = programs.filter(p => allowed.includes(p.major));
        }
      }

      const profile = this.data.userProfile || {};
      programs = programs.map(p => ({ ...p, tier: classifyProgram(p, profile) }));
      const reach = programs.filter(p => p.tier === 'reach');
      const match = programs.filter(p => p.tier === 'match');
      const safety = programs.filter(p => p.tier === 'safety');
      this.setData({ reach, match, safety, loading: false, noMatchData: false, loadError: false });
      this.loadFavorites();
    } catch (err) {
      console.error('[match] fallback failed', err);
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

  goToDiagnosis() { wx.switchTab({ url: '/pages/diagnosis/diagnosis' }) },
  goToSimulator() { wx.navigateTo({ url: '/pages/simulator/simulator' }) },
  goToProfile() { wx.navigateTo({ url: '/pages/profile/step1-school/step1-school' }) }
});