// pages/diagnosis/diagnosis.js
const { classifyProgram } = require('../../utils/util');
const app = getApp();

// 硬编码用户维度计算（基于 profile 字段映射到 7 维 0-100 分）
function calcUserDimensions(profile) {
  if (!profile) return [60, 60, 0, 0, 0, 0, 0];

  const schoolRank = {
    '985 · C9 联盟': 95, '985': 85, '211': 75,
    '双一流': 70, '海外本科': 75, '中外合办': 70,
    '双非一本': 60, '双非二本': 50
  };
  const dimSchool = schoolRank[profile.schoolLevel] || (profile.schoolLevel ? 70 : 60);

  const gpa = profile.gpa || 0;
  const dimGpa = Math.min(100, Math.round((gpa / 4.0) * 100));

  const toefl = profile.toefl || 0;
  const dimToefl = Math.min(100, Math.round((toefl / 120) * 100));

  const gre = profile.gre || 0;
  const dimGre = gre > 0 ? Math.min(100, Math.round((gre / 340) * 100)) : 0;

  const internships = profile.internships || [];
  const dimIntern = Math.min(100, internships.length * 30);

  const research = profile.research || [];
  const dimResearch = Math.min(100, research.length * 25);

  const is985orC9 = profile.schoolLevel && profile.schoolLevel.includes('985');
  const hasPaper = research.some(r => r.type && r.type.includes('论文'));
  const dimPaper = hasPaper ? 75 : research.length > 0 ? 30 : 0;

  return [dimSchool, dimGpa, dimToefl, dimGre, dimIntern, dimResearch, dimPaper];
}

Page({
  data: {
    benchTier: 'match',
    userData: [60, 60, 0, 0, 0, 0, 0],
    benchByTier: {
      reach: [88, 82, 80, 80, 75, 85, 75],
      match: [80, 75, 75, 75, 70, 80, 68],
      safety: [70, 65, 60, 55, 60, 60, 55],
    },
    indicators: [
      { name: '院校背景' }, { name: 'GPA' }, { name: '语言' },
      { name: '标化' }, { name: '实习' }, { name: '科研论文' }, { name: '推荐信' }
    ],
    dimensions: [],
    compositeScore: 0,
    compositeDesc: '',
    profileTags: []
  },

  onLoad() {
    this.loadBenchmarks();
  },

  onShow() {
    setTimeout(() => this.drawRadar(this.data.benchTier), 100);
  },

  calcDimensionsFromProfile() {
    const profile = app.globalData.userProfile || {};
    const userData = calcUserDimensions(profile);
    this.setData({ userData });
    this.renderDimensions();

    // 计算综合评分（使用 calcScore 从 util）
    const { calcScore } = require('../../utils/util');
    const scoreState = {
      gpa: profile.gpa || 0,
      toefl: profile.toefl || 0,
      gre: profile.gre || 0,
      paperCount: (profile.research || []).filter(r => r.type && r.type.includes('论文')).length,
      researchCount: (profile.research || []).length,
      internCount: (profile.internships || []).length,
      awardCount: 0
    };
    const compositeScore = calcScore(scoreState);
    const descPieces = [];
    if (profile.gpa && profile.gpa >= 3.5) descPieces.push(`GPA ${profile.gpa} 具有竞争力`);
    else if (profile.gpa && profile.gpa < 3.0) descPieces.push('GPA 偏低，建议提升');
    if (!profile.toefl && !profile.gre) descPieces.push('标化成绩未填写');
    if (profile.internships && profile.internships.length >= 2) descPieces.push(`${profile.internships.length}段实习不错`);
    if (profile.research && profile.research.length > 0) descPieces.push(`${profile.research.length}段科研经历`);
    this.setData({
      compositeScore,
      compositeDesc: descPieces.length > 0 ? descPieces.join('；') : '填写更多档案信息获取精准诊断'
    });

    // 档案标签
    const tags = [];
    if (profile.schoolLevel) tags.push(profile.schoolLevel);
    if (profile.gpa) tags.push(`GPA ${profile.gpa}`);
    if (profile.toefl) tags.push(`TOEFL ${profile.toefl}`);
    if (profile.gre) tags.push(`GRE ${profile.gre}`);
    if (profile.internships) {
      profile.internships.forEach(i => { if (i.name) tags.push(i.name); });
    }
    if (profile.research) {
      profile.research.forEach(r => { if (r.name) tags.push(r.name); });
    }
    this.setData({ profileTags: tags.slice(0, 6) });
  },

  renderDimensions() {
    const { userData, benchByTier, benchTier, indicators } = this.data;
    const benchData = benchByTier[benchTier] || benchByTier.match;
    const dimensions = indicators.map((ind, i) => {
      const user = userData[i] || 0;
      const bench = benchData[i] || 0;
      const diff = user - bench;
      let diffText, color;
      if (diff > 10) { diffText = `优于平均 +${diff}%`; color = 'var(--c-accent)'; }
      else if (diff >= -5) { diffText = `基本对齐 (${diff > 0 ? '+' : ''}${diff}%)`; color = '#a07d28'; }
      else { diffText = `低于平均 ${diff}%`; color = '#b4633a'; }

      return {
        name: ind.name,
        user, bench,
        diff: diffText,
        color,
        userVal: String(user),
        benchVal: String(bench),
        userPercent: user,
        benchPercent: bench
      };
    });
    this.setData({ dimensions });
  },

  // app.js 登录完成后回调
  onProfileReady() {
    this.calcDimensionsFromProfile();
    this.drawRadar(this.data.benchTier);
  },

  async loadBenchmarks() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getBenchmarks' });
      const benchMap = res.result.benchmarks || {};
      if (Object.keys(benchMap).length > 0) {
        this.setData({ benchByTier: benchMap });
      }
    } catch (err) {
      console.error('[loadBenchmarks] 云端加载失败，使用本地硬编码数据', err);
    }
    this.calcDimensionsFromProfile();
    this.drawRadar(this.data.benchTier);
  },

  onBenchChange(e) {
    const tier = e.detail.value;
    this.setData({ benchTier: tier });
    this.renderDimensions();
    this.drawRadar(tier);
  },

  drawRadar(tier) {
    const { userData, benchByTier, indicators } = this.data;
    const benchData = benchByTier[tier];

    // 小程序中无法直接使用 ECharts，用 canvas 绘制简化版雷达图
    const ctx = wx.createCanvasContext('radarCanvas');
    const width = 300;
    const height = 300;
    const cx = width / 2;
    const cy = height / 2;
    const radius = 100;

    ctx.clearRect(0, 0, width, height);

    // 绘制网格
    const levels = 4;
    for (let l = 1; l <= levels; l++) {
      const r = (radius / levels) * l;
      ctx.beginPath();
      for (let i = 0; i < indicators.length; i++) {
        const angle = (Math.PI * 2 * i) / indicators.length - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.setStrokeStyle('#e4e4e4');
      ctx.setLineWidth(1);
      ctx.stroke();
    }

    // 绘制连线
    for (let i = 0; i < indicators.length; i++) {
      const angle = (Math.PI * 2 * i) / indicators.length - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.setStrokeStyle('#e4e4e4');
      ctx.setLineWidth(1);
      ctx.stroke();
    }

    // 绘制数据（用户）
    ctx.beginPath();
    for (let i = 0; i < indicators.length; i++) {
      const angle = (Math.PI * 2 * i) / indicators.length - Math.PI / 2;
      const r = (userData[i] / 100) * radius;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.setFillStyle('rgba(46,93,80,0.22)');
    ctx.setStrokeStyle('#2e5d50');
    ctx.setLineWidth(2);
    ctx.fill();
    ctx.stroke();

    // 绘制数据（基准）
    ctx.beginPath();
    for (let i = 0; i < indicators.length; i++) {
      const angle = (Math.PI * 2 * i) / indicators.length - Math.PI / 2;
      const r = (benchData[i] / 100) * radius;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.setFillStyle('rgba(201,138,75,0.12)');
    ctx.setStrokeStyle('#c98a4b');
    ctx.setLineWidth(2);
    ctx.setLineDash([4, 4]);
    ctx.fill();
    ctx.stroke();

    // 绘制标签
    ctx.setFontSize(11);
    ctx.setFillStyle('#5c5c5c');
    ctx.setTextAlign('center');
    for (let i = 0; i < indicators.length; i++) {
      const angle = (Math.PI * 2 * i) / indicators.length - Math.PI / 2;
      const x = cx + (radius + 20) * Math.cos(angle);
      const y = cy + (radius + 20) * Math.sin(angle);
      ctx.fillText(indicators[i].name, x, y);
    }

    ctx.draw();
  },

  goToSimulator() {
    wx.navigateTo({ url: '/pages/simulator/simulator' });
  }
});
