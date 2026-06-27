// pages/essay/essay.js
const app = getApp();

Page({
  data: {
    // 用户档案
    profile: app.globalData.userProfile,
    // 计算字段
    researchCount: (app.globalData.userProfile?.research || []).length || 1,
    internshipCount: (app.globalData.userProfile?.internships || []).length || 2,
    // 文书类型列表
    docTypes: [
      { id: 'sop', name: '个人陈述 (SoP)', desc: '最核心的申请文书，讲述你的学术动机与准备', icon: 'S', price: '¥9.99' },
      { id: 'ps', name: '个人自传 (PS)', desc: '更全面的个人故事，适合部分院校要求', icon: 'P', price: '¥9.99' },
      { id: 'rl', name: '推荐信 (LoR)', desc: '为推荐人提供框架，突出你的核心优势', icon: 'L', price: '¥6.99' },
      { id: 'cv', name: '学术简历 (CV)', desc: '一页纸精炼呈现你的学术与职业经历', icon: 'C', price: '¥6.99' },
      { id: 'rp', name: '研究计划 (RP)', desc: '博士/研究型硕士申请必备', icon: 'R', price: '¥14.99' },
      { id: 'diversity', name: '多样性陈述', desc: '部分美国院校要求的补充文书', icon: 'D', price: '¥4.99' },
    ],
    // 当前选中的文书类型
    selectedType: null,
    selectedTypeName: '',
    selectedTypePrice: '¥9.99',
    // 生成的文书内容
    generatedDoc: null,
    // 是否已付费
    isPaid: false,
    // 生成状态
    generating: false,
    // 免费预览内容
    previewContent: null,
    // 付费解锁后的完整内容
    fullContent: null,
    // 模板列表
    templates: [
      { id: 'cs', name: 'CS 方向模板', desc: '适合计算机科学、数据科学等' },
      { id: 'mkt', name: 'MKT 方向模板', desc: '适合市场营销、商业分析等' },
      { id: 'general', name: '通用模板', desc: '适合跨专业或不确定方向' },
    ],
    selectedTemplate: 'cs',
    // 用户输入
    userInput: {
      targetSchool: '',
      targetProgram: '',
      highlight: '',
      reason: '',
    }
  },

  onLoad() {
    this.setData({
      profile: app.globalData.userProfile,
      researchCount: (app.globalData.userProfile?.research || []).length || 1,
      internshipCount: (app.globalData.userProfile?.internships || []).length || 2,
    });
  },

  onShow() {
    this.setData({
      profile: app.globalData.userProfile,
      researchCount: (app.globalData.userProfile?.research || []).length || 1,
      internshipCount: (app.globalData.userProfile?.internships || []).length || 2,
    });
  },

  selectType(e) {
    const id = e.currentTarget.dataset.id;
    const type = this.data.docTypes.find(t => t.id === id);
    this.setData({ 
      selectedType: id,
      selectedTypeName: type ? type.name : '',
      selectedTypePrice: type ? type.price : '¥9.99',
      generatedDoc: null,
      previewContent: null,
      fullContent: null,
      isPaid: false
    });
  },

  selectTemplate(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedTemplate: id });
  },

  onInputChange(e) {
    const key = e.currentTarget.dataset.key;
    this.data.userInput[key] = e.detail.value;
    this.setData({ userInput: this.data.userInput });
  },

  // 生成文书（免费预览）
  generatePreview() {
    const { selectedType, selectedTemplate, profile, userInput } = this.data;
    if (!selectedType) {
      wx.showToast({ title: '请先选择文书类型', icon: 'none' });
      return;
    }

    this.setData({ generating: true });

    // 模拟生成过程
    setTimeout(() => {
      const typeName = this.data.docTypes.find(t => t.id === selectedType)?.name || '文书';
      const school = userInput.targetSchool || '目标院校';
      const program = userInput.targetProgram || '目标项目';
      const major = profile.major || '计算机科学';

      const preview = `【${typeName} · 免费预览】

尊敬的招生委员会：

我是一名来自${profile.school || '某985高校'}的${major}专业学生，现申请贵校${school}的${program || '研究生项目'}项目。

在本科期间，我始终保持对${major}领域的浓厚兴趣。我的GPA为${profile.gpa || 3.65}（满分4.0），专业排名前15%。${profile.research && profile.research.length > 0 ? '我曾参与' + profile.research[0].name + '，这段经历让我深入理解了前沿研究方向。' : ''}

${profile.internships && profile.internships.length > 0 ? '此外，我在' + profile.internships.map(i => i.name).join('和') + '的实习经历，让我将课堂所学应用于实际工业场景。' : ''}

...（完整内容需付费解锁）`;

      this.setData({
        generating: false,
        previewContent: preview,
        fullContent: null,
        isPaid: false
      });
    }, 1500);
  },

  // 付费解锁完整文书
  onPay() {
    const { selectedType, previewContent, profile, userInput } = this.data;
    if (!previewContent) {
      wx.showToast({ title: '请先生成预览', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '解锁完整文书',
      content: '确认支付 ¥' + this.getPrice() + ' 获取完整版模拟文书？',
      success: (res) => {
        if (res.confirm) {
          this.generateFullContent();
        }
      }
    });
  },

  getPrice() {
    const type = this.data.docTypes.find(t => t.id === this.data.selectedType);
    return type ? type.price.replace('¥', '') : '9.99';
  },

  generateFullContent() {
    const { selectedType, selectedTemplate, profile, userInput } = this.data;
    const typeName = this.data.docTypes.find(t => t.id === selectedType)?.name || '文书';
    const school = userInput.targetSchool || '目标院校';
    const program = userInput.targetProgram || '目标项目';
    const major = profile.major || '计算机科学';
    const highlight = userInput.highlight || '突出的科研与实习经历';
    const reason = userInput.reason || '对前沿技术的热情与追求';

    const full = `【${typeName} · 完整版】

尊敬的招生委员会：

我是一名来自${profile.school || '某985高校'}的${major}专业学生，现申请贵校${school}的${program || '研究生项目'}项目。我希望通过这封文书，向您展示我的学术背景、研究经历以及未来的学术目标。

一、学术背景

在本科期间，我始终保持对${major}领域的浓厚兴趣。我的GPA为${profile.gpa || 3.65}（满分4.0），专业排名前15%。在核心课程如数据结构、算法设计、机器学习、数据库原理中均取得90+的成绩。${profile.schoolLevel === '985' ? '作为985高校的学生，我接受了系统而严格的学术训练。' : ''}

二、研究经历

${profile.research && profile.research.length > 0 ? '我曾参与' + profile.research[0].name + '。在这段经历中，我深入研究了前沿的AI技术方向，独立完成了核心模块的设计与实现，并撰写了技术报告。这段经历不仅锻炼了我的科研能力，更让我坚定了在' + major + '领域继续深造的决心。' : '在本科阶段，我积极参与课程项目与实验室工作，积累了扎实的研究基础。'}

${profile.research && profile.research.length > 1 ? '此外，我还参与了' + profile.research[1].name + '，进一步拓宽了我的研究视野。' : ''}

三、实习经历

${profile.internships && profile.internships.length > 0 ? '在' + profile.internships.map(i => i.name).join('和') + '的实习经历，让我有机会将课堂所学应用于实际工业场景。' + (profile.internships[0]?.type === '大厂(BAT/MAANG)' ? '在头部互联网公司的实习经历，让我深刻理解了大规模系统的设计与优化。' : '') : '通过课程项目和实验室工作，我积累了丰富的实践经验。'}

四、${highlight}

${reason}。${profile.toefl >= 100 ? '我的TOEFL成绩为' + profile.toefl + '，具备良好的英语交流与学术写作能力。' : '我正在积极准备语言考试，力争在入学前达到理想的英语水平。'}

五、选择贵校的理由

贵校在${major}领域享有盛誉，${school}的${program}项目课程设置与我的学术兴趣高度契合。我特别关注贵校在AI/ML方向的研究成果，希望能加入贵校的实验室，在教授的指导下开展深入研究。

六、未来规划

短期目标：在研究生阶段系统学习${major}前沿知识，参与高水平科研项目，争取发表高质量论文。长期目标：毕业后进入业界顶级研究实验室或继续攻读博士学位，在${major}领域做出有影响力的贡献。

感谢招生委员会审阅我的申请材料。我期待有机会在${school}继续我的学术之旅。

此致
敬礼

[申请人姓名]
${profile.school || '某985高校'} · ${major}专业
`;

    this.setData({
      fullContent: full,
      isPaid: true,
      previewContent: null
    });

    wx.showToast({ title: '解锁成功！', icon: 'success' });
  },

  // 复制文书
  copyContent() {
    const content = this.data.fullContent || this.data.previewContent;
    if (!content) return;
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'GradGuide - AI 模拟文书生成',
      path: '/pages/essay/essay'
    };
  }
});
