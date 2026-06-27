// pages/diagnosis/diagnosis.js
const { classifyProgram } = require('../../utils/util');
const app = getApp();

// Canvas 颜色集中管理(令牌系统对 Canvas 无效,故抽常量方便协作者改色)
const COLORS = {
  grid: '#e4e4e4',
  label: '#5c5c5c',
  user: '#2e5d50',
  userFill: 'rgba(46,93,80,0.22)',
  bench: '#c98a4b',
  benchFill: 'rgba(201,138,75,0.12)',
};

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
    loading: true,  // 添加加载状态
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
    // 仅在数据加载完成后渲染，避免首屏显示 0 分空状态
    if (!this.data.loading) {
      this.calcDimensionsFromProfile();
      this.drawRadarAnimated();
    }
  },

  onHide() {
    this._cleanupRadar();
  },

  onUnload() {
    this._cleanupRadar();
  },

  // 清理雷达动画定时器,避免页面销毁后回调报错 + _radarAnimating 死锁
  _cleanupRadar() {
    if (this._radarTimer) {
      clearTimeout(this._radarTimer);
      this._radarTimer = null;
    }
    this._radarAnimating = false;
  },

  async onPullDownRefresh() {
    this.calcDimensionsFromProfile();
    await this.loadBenchmarks();
    wx.stopPullDownRefresh();
  },

  // app.js 登录完成后回调
  onProfileReady() {
    // 加载基准数据（已完成则不再重复）
    if (!this._benchmarksLoaded) {
      this.loadBenchmarks();
    }
  },

  calcDimensionsFromProfile() {
    const profile = app.globalData.userProfile || {};
    const userData = calcUserDimensions(profile);
    this.setData({ userData });
    this.renderDimensions();

    const { calcScore } = require('../../utils/util');
    const compositeScore = calcScore(this._buildScoreState(profile));
    this.setData({ compositeDesc: this._buildScoreDesc(profile) });
    this._countUp('compositeScore', compositeScore, 600);
    this.setData({ profileTags: this._buildProfileTags(profile) });
  },

  // 构建评分入参(供 calcScore)
  _buildScoreState(profile) {
    return {
      gpa: profile.gpa || 0,
      toefl: profile.toefl || 0,
      gre: profile.gre || 0,
      paperCount: (profile.research || []).filter(r => r.type && r.type.includes('论文')).length,
      researchCount: (profile.research || []).length,
      internCount: (profile.internships || []).length,
      awardCount: 0
    };
  },

  // 拼接综合评分描述文案(产品文案与算分分离)
  _buildScoreDesc(profile) {
    const pieces = [];
    if (profile.gpa && profile.gpa >= 3.5) pieces.push(`GPA ${profile.gpa} 具有竞争力`);
    else if (profile.gpa && profile.gpa < 3.0) pieces.push('GPA 偏低，建议提升');
    if (!profile.toefl && !profile.gre) pieces.push('标化成绩未填写');
    if (profile.internships && profile.internships.length >= 2) pieces.push(`${profile.internships.length}段实习不错`);
    if (profile.research && profile.research.length > 0) pieces.push(`${profile.research.length}段科研经历`);
    return pieces.length > 0 ? pieces.join('；') : '填写更多档案信息获取精准诊断';
  },

  // 构建档案标签(最多 6 个)
  _buildProfileTags(profile) {
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
    return tags.slice(0, 6);
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

  _countUp(key, target, duration) {
    // 已达终值则跳过,避免 onShow/onProfileReady 重复触发时数字从 0 重数
    if (this.data[key] === target) return;
    if (this._countUpTimers && this._countUpTimers[key]) {
      clearInterval(this._countUpTimers[key]);
    }
    const reduced = getApp().globalData.reducedMotion;
    if (reduced || !target) {
      this.setData({ [key]: target });
      return;
    }
    this._countUpTimers = this._countUpTimers || {};
    const steps = Math.max(1, Math.floor(duration / 30));
    const stepVal = target / steps;
    let cur = 0;
    let i = 0;
    this.setData({ [key]: 0 });
    this._countUpTimers[key] = setInterval(() => {
      i++;
      cur = i >= steps ? target : Math.round(stepVal * i);
      this.setData({ [key]: cur });
      if (i >= steps) {
        clearInterval(this._countUpTimers[key]);
        delete this._countUpTimers[key];
      }
    }, 30);
  },

  /* =========================================================
     雷达图:走马灯逐边绘制
     先沿基准(黄)七边形边缘逐边画线，画完填充；
     再沿用户(绿)七边形边缘逐边画线，画完填充。
     14 边 × 4 帧/边 = 56 帧 × 16ms ≈ 900ms
     ========================================================= */

  drawRadarAnimated() {
    if (this._radarAnimating) return;
    if (this._radarTimer) clearTimeout(this._radarTimer);
    this._radarAnimating = true;

    const TOTAL = 56;
    let frame = 0;
    const animate = () => {
      const progress = (frame / TOTAL) * 14;  // 0~14
      this.drawRadar(this.data.benchTier, progress);
      frame++;
      if (frame <= TOTAL) {
        this._radarTimer = setTimeout(animate, 16);
      } else {
        this.drawRadar(this.data.benchTier, 14);  // 终态完整
        this._radarAnimating = false;
        this._radarTimer = null;
      }
    };
    animate();
  },

  /* 雷达图绘制
     progress — 0~7 黄框走马灯, 7~14 绿框走马灯, 14=完整
     非动画调用传 14
  */
  drawRadar(tier, progress) {
    const p = progress != null ? progress : 14;
    const { userData, benchByTier, indicators } = this.data;
    const benchData = benchByTier[tier];
    const count = indicators.length;
    // 角度公式抽函数(原本重复 4 次)
    const angleOf = (i) => (Math.PI * 2 * i) / count - Math.PI / 2;

    const ctx = wx.createCanvasContext('radarCanvas');
    const width = 300, height = 300;
    const cx = width / 2, cy = height / 2;
    const radius = 100;

    ctx.clearRect(0, 0, width, height);

    // 顶点终位坐标
    const vertsOf = (dataArr) => dataArr.map((val, i) => {
      const a = angleOf(i);
      const r = (val / 100) * radius;
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });

    // — 网格 —
    for (let l = 1; l <= 4; l++) {
      const r = (radius / 4) * l;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const a = angleOf(i);
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.setStrokeStyle(COLORS.grid);
      ctx.setLineWidth(1);
      ctx.stroke();
    }

    // — 辐线 —
    for (let i = 0; i < count; i++) {
      const a = angleOf(i);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
      ctx.setStrokeStyle(COLORS.grid);
      ctx.setLineWidth(1);
      ctx.stroke();
    }

    // — 标签(始终显示) —
    ctx.setFontSize(11);
    ctx.setFillStyle(COLORS.label);
    ctx.setTextAlign('center');
    for (let i = 0; i < count; i++) {
      const a = angleOf(i);
      ctx.fillText(indicators[i].name, cx + (radius + 20) * Math.cos(a), cy + (radius + 20) * Math.sin(a));
    }

    // 走马灯:沿多边形边缘逐边画线 + 实时填充(已画部分闭合回起点再 fill)
    const tracePoly = (verts, seg, fillColor, strokeColor, lineWidth, isDash) => {
      const done = Math.min(Math.floor(seg), count);
      const frac = seg - Math.floor(seg);
      if (done === 0 && frac === 0) return;
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 0; i < done; i++) {
        ctx.lineTo(verts[(i + 1) % count].x, verts[(i + 1) % count].y);
      }
      let endX, endY;
      if (done < count && frac > 0) {
        const from = verts[done];
        const to = verts[(done + 1) % count];
        endX = from.x + (to.x - from.x) * frac;
        endY = from.y + (to.y - from.y) * frac;
        ctx.lineTo(endX, endY);
      } else {
        endX = verts[done % count].x;
        endY = verts[done % count].y;
      }
      ctx.closePath();  // 闭合回起点 → 形成可填充区域
      ctx.setFillStyle(fillColor);
      ctx.fill();
      ctx.setStrokeStyle(strokeColor);
      ctx.setLineWidth(lineWidth);
      if (isDash) ctx.setLineDash([4, 4]);
      ctx.stroke();
      if (isDash) ctx.setLineDash([]);
    };

    // 完整多边形(边 + 填充)
    const fillPoly = (verts, fillColor, strokeColor, lineWidth, isDash) => {
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < count; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      ctx.setFillStyle(fillColor);
      ctx.fill();
      ctx.setStrokeStyle(strokeColor);
      ctx.setLineWidth(lineWidth);
      if (isDash) ctx.setLineDash([4, 4]);
      ctx.stroke();
      if (isDash) ctx.setLineDash([]);
    };

    const benchVerts = vertsOf(benchData);
    const userVerts = vertsOf(userData);

    // 阶段 1: 黄框(基准)走马灯
    if (p < 7) {
      tracePoly(benchVerts, p, COLORS.benchFill, COLORS.bench, 2, true);
    } else {
      // 黄框完成 → 填充
      fillPoly(benchVerts, COLORS.benchFill, COLORS.bench, 2, true);

      // 阶段 2: 绿框(用户)走马灯
      const greenSeg = p - 7;
      if (greenSeg < 7) {
        tracePoly(userVerts, greenSeg, COLORS.userFill, COLORS.user, 2, false);
      } else {
        // 绿框完成 → 填充 + 顶点圆点
        fillPoly(userVerts, COLORS.userFill, COLORS.user, 2, false);
        for (let i = 0; i < count; i++) {
          ctx.beginPath();
          ctx.arc(userVerts[i].x, userVerts[i].y, 3, 0, Math.PI * 2);
          ctx.setFillStyle(COLORS.user);
          ctx.fill();
        }
      }
    }

    ctx.draw();
  },

  async loadBenchmarks() {
    // 防止重复加载（onLoad + onProfileReady 都可能触发）
    if (this._benchmarksLoading) return;
    this._benchmarksLoading = true;

    // ==============================================
    // 【核心优化】优先读缓存：登录时已在后台预加载
    // ==============================================
    const app = getApp();
    const cached = app.getCachedBenchmarks();
    if (cached && Object.keys(cached).length > 0) {
      console.log('[diagnosis] using cache benchmarks (no API call)');
      this.setData({ benchByTier: cached });
      this.calcDimensionsFromProfile();
      this.drawRadarAnimated();
      this.setData({ loading: false });
      this._benchmarksLoaded = true;
      this._benchmarksLoading = false;
      return;
    }

    // 缓存未命中：正常请求
    try {
      const res = await wx.cloud.callFunction({ name: 'getBenchmarks' });
      const benchMap = res.result.benchmarks || {};
      if (Object.keys(benchMap).length > 0) {
        this.setData({ benchByTier: benchMap });
      }
    } catch (err) {
      console.error('[loadBenchmarks] 云端加载失败，使用本地硬编码数据', err);
    }

    // 数据准备完成，计算并渲染
    this.calcDimensionsFromProfile();
    this.drawRadarAnimated();

    // 结束 loading，标记已加载
    this.setData({ loading: false });
    this._benchmarksLoaded = true;
    this._benchmarksLoading = false;
  },

  goToSimulator() {
    wx.navigateTo({ url: '/pages/simulator/simulator' });
  }
});
