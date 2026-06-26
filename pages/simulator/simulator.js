// pages/simulator/simulator.js
const { calcScore, calcTier, fmtDelta } = require('../../utils/util');
const app = getApp();

const baseline = { gpa: 3.65, toefl: 98, gre: 0, paper: false, research: false, intern: false, award: false };
const baseScore = 73;
const baseTier = { reach: 5, match: 10, safe: 6 };

Page({
  data: {
    baseline: null,
    simResult: null,
    diff: null,
    newPrograms: { reach: [], match: [], safety: [] },
    upgradedPrograms: [],
    downgradedPrograms: [],
    showResult: false,
    simulating: false,
    // keep existing fields
    state: { gpa: '', toefl: '', gre: '', paper: false, research: false, intern: false, award: false },
    baseScore: 73,
    baseTier: { reach: 5, match: 10, safe: 6 },
    score: 73,
    tier: { reach: 0, match: 0, safe: 0 },
    scoreDelta: 0,
    unlockedList: [],
    todoItems: { thisWeek: [], thisMonth: [], thisQuarter: [] },
    history: [],
    showHistory: false,
    loadingTodos: true,
    loadingHistory: false,
    saving: false
  },

  onLoad() {
    this.loadBaseline()
    this.loadTodos()
    this.loadHistory()
  },

  onShow() {
    this.loadTodos();
    this.loadHistory();
  },

  async loadBaseline() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getUser' })
      const match = res.result?.matchResult
      if (match && (match.reach || match.match || match.safety)) {
        this.setData({ baseline: match })
      }
    } catch (err) {
      console.error('[simulator] load baseline failed', err)
    }
    // Load user real profile as initial state
    const profile = app.globalData.userProfile || {}
    this.setData({
      state: {
        gpa: profile.gpa || '',
        toefl: profile.toefl || '',
        gre: profile.gre || '',
        paper: false,
        research: false,
        intern: false,
        award: false
      }
    })
  },

  // 云端生成 TODO
  async loadTodos() {
    this.setData({ loadingTodos: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'generateTodos' });
      const todos = res.result || {};
      this.setData({
        todoItems: {
          thisWeek: todos.thisWeek || [],
          thisMonth: todos.thisMonth || [],
          thisQuarter: todos.thisQuarter || []
        },
        loadingTodos: false
      });
    } catch (err) {
      console.error('[loadTodos] 云端获取失败，使用默认 TODO', err);
      this.setData({
        todoItems: {
          thisWeek: [
            { id: 'tw1', text: '邮件联系本校 NLP 实验室张教授，询问是否可以加入暑期 RA', time: '30 分钟', impact: '科研维度 +12', checked: false },
            { id: 'tw2', text: '注册 GRE 8 月场次，开始为期 8 周备考计划', time: '1 小时', impact: '标化 +25', checked: false },
            { id: 'tw3', text: '整理已有实习经历，更新简历和 LinkedIn 主页', time: '2 小时', impact: '实习维度 +5', checked: false },
          ],
          thisMonth: [
            { id: 'tm1', text: '完成 LeetCode hot 100 + 系统设计 1 本', checked: false },
            { id: 'tm2', text: '联系 3 位海外教授开放暑研机会', checked: false },
            { id: 'tm3', text: 'TOEFL 二刷，目标 105+', checked: false },
            { id: 'tm4', text: '撰写第一版 SoP 框架', checked: false },
          ],
          thisQuarter: [
            { id: 'tq1', text: '完成第二段顶级大厂实习', checked: false },
            { id: 'tq2', text: '暑研产出至少 1 篇 workshop paper', checked: false },
            { id: 'tq3', text: 'GRE 出分 ≥ 320', checked: false },
            { id: 'tq4', text: '联系 3 位海外教授开放暑研机会', checked: false },
          ]
        },
        loadingTodos: false
      });
    }
  },

  async onSimulate() {
    this.setData({ simulating: true, showResult: false })
    try {
      const res = await wx.cloud.callFunction({
        name: 'simulateMatcher',
        data: {
          gpa: parseFloat(this.data.state.gpa) || 0,
          toefl: parseFloat(this.data.state.toefl) || 0,
          gre: parseFloat(this.data.state.gre) || 0,
          paper: this.data.state.paper,
          research: this.data.state.research,
          intern: this.data.state.intern,
          award: this.data.state.award
        }
      })
      this.setData({
        simResult: res.result.simResult,
        diff: res.result.diff,
        newPrograms: res.result.newPrograms,
        upgradedPrograms: res.result.upgradedPrograms || [],
        downgradedPrograms: res.result.downgradedPrograms || [],
        showResult: true,
        simulating: false
      })
    } catch (err) {
      console.error('[simulate] failed', err)
      wx.showToast({ title: '模拟失败，请重试', icon: 'none' })
      this.setData({ simulating: false })
    }
  },

  // 加载历史记录
  async loadHistory() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getSimHistory' });
      this.setData({ history: res.result.list || [] });
    } catch (err) {
      console.error('[loadHistory]', err);
    }
  },

  // 保存当前模拟结果
  async onSaveResult() {
    if (this.data.saving) return;
    this.setData({ saving: true });

    try {
      await wx.cloud.callFunction({
        name: 'saveSimResult',
        data: {
          state: { ...this.data.state },
          score: this.data.score,
          tier: { ...this.data.tier },
          unlocked: [...this.data.unlockedList]
        }
      });
      wx.showToast({ title: '结果已保存', icon: 'success' });
      this.loadHistory();
    } catch (err) {
      console.error('[onSaveResult]', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }

    this.setData({ saving: false });
  },

  // 删除历史记录
  async onDeleteHistory(e) {
    const timestamp = e.currentTarget.dataset.timestamp;
    try {
      await wx.cloud.callFunction({
        name: 'deleteSimResult',
        data: { timestamp }
      });
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadHistory();
    } catch (err) {
      console.error('[onDeleteHistory]', err);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  // 加载历史记录到模拟器
  onLoadHistory(e) {
    const idx = e.currentTarget.dataset.index;
    const record = this.data.history[idx];
    if (!record) return;
    this.setData({
      state: { ...record.state },
      showHistory: false
    });
    this.update();
    wx.showToast({ title: '已加载历史配置', icon: 'success' });
  },

  toggleHistory() {
    this.setData({ showHistory: !this.data.showHistory });
  },

  onSliderChange(e) {
    const key = e.currentTarget.dataset.key;
    const val = parseFloat(e.detail.value);
    this.data.state[key] = val;
    this.setData({ state: this.data.state });
    this.update();
  },

  onBoostChange(e) {
    const key = e.currentTarget.dataset.boost;
    this.data.state[key] = e.detail.value.length > 0;
    this.setData({ state: this.data.state });
    this.update();
  },

  onReset() {
    this.loadBaseline()
    this.setData({ showResult: false, simResult: null, diff: null, newPrograms: { reach: [], match: [], safety: [] }, upgradedPrograms: [], downgradedPrograms: [] })
  },

  // TODO 勾选
  onTodoCheck(e) {
    const { section, id } = e.currentTarget.dataset;
    const items = this.data.todoItems[section];
    const idx = items.findIndex(i => i.id === id);
    if (idx > -1) {
      items[idx].checked = !items[idx].checked;
      this.setData({ todoItems: this.data.todoItems });
    }
  },

  update() {
    const s = this.data.state;
    const score = calcScore(s);
    const tier = calcTier(score, this.data.baseScore, this.data.baseTier);
    const delta = score - this.data.baseScore;

    // 计算解锁列表
    const unlocked = [];
    if (s.gpa > 3.7 || s.gre > 320) unlocked.push('CMU MSCS', 'Columbia CS');
    if (s.toefl >= 105) unlocked.push('Cambridge ACS');
    if (s.paper) unlocked.push('UC Berkeley EECS', 'HKU CS');
    if (s.research) unlocked.push('Imperial Computing');

    this.setData({
      score,
      tier,
      scoreDelta: delta,
      unlockedList: unlocked
    });
  }
});
