// 公共数据模块
// 设计规范：极简 / 冷静专业 / 主色 #2e5d50 / 无渐变 / 无 emoji（用 Remix Icon 替代为小程序图标）

// 学校项目库
const PROGRAMS = [
  // ---- US CS ----
  { id:1, school:'Carnegie Mellon University', shortName:'CMU', country:'US', region:'美国', major:'CS', rank:'US #3', minGpa:3.7, avgGpa:3.85, toefl:100, gre:'325+', tier:'reach', deadline:'12月10日', tuition:'$70,000/年', duration:'16个月', highlight:'CS 全美第一，强调科研背景', selectivityBand:'elite' },
  { id:2, school:'Columbia University', shortName:'Columbia', country:'US', region:'美国', major:'CS', rank:'US #12', minGpa:3.3, avgGpa:3.6, toefl:99, gre:'320+', tier:'reach', deadline:'2月15日', tuition:'$65,000/年', duration:'1.5-2年', highlight:'地处纽约，实习资源丰富', selectivityBand:'high' },
  { id:3, school:'University of Southern California', shortName:'USC', country:'US', region:'美国', major:'CS', rank:'US #28', minGpa:3.0, avgGpa:3.5, toefl:90, gre:'315+', tier:'match', deadline:'1月15日', tuition:'$60,000/年', duration:'1.5-2年', highlight:'校友资源强，中国学生多', selectivityBand:'mid' },
  { id:4, school:'Northeastern University', shortName:'NEU', country:'US', region:'美国', major:'CS', rank:'US #44', minGpa:3.0, avgGpa:3.4, toefl:90, gre:'可选', tier:'match', deadline:'滚动录取', tuition:'$50,000/年', duration:'2年', highlight:'Co-op 实习项目知名', selectivityBand:'mid' },
  { id:5, school:'Stevens Institute of Technology', shortName:'Stevens', country:'US', region:'美国', major:'CS', rank:'US #76', minGpa:2.8, avgGpa:3.3, toefl:80, gre:'可选', tier:'safety', deadline:'滚动录取', tuition:'$45,000/年', duration:'1.5-2年', highlight:'录取友好，性价比高', selectivityBand:'friendly' },
  // ---- HK CS ----
  { id:6, school:'香港大学', shortName:'HKU', country:'HK', region:'香港', major:'CS', rank:'QS #17', minGpa:3.2, avgGpa:3.6, toefl:90, gre:'可选', tier:'reach', deadline:'1月31日', tuition:'港币18万/年', duration:'1年', highlight:'港校 CS 第一，海归就业好', selectivityBand:'elite' },
  { id:7, school:'香港中文大学', shortName:'CUHK', country:'HK', region:'香港', major:'CS', rank:'QS #36', minGpa:3.0, avgGpa:3.5, toefl:79, gre:'不需要', tier:'match', deadline:'2月28日', tuition:'港币16万/年', duration:'1年', highlight:'录取友好，适合冲刺转专业', selectivityBand:'mid' },
  { id:8, school:'香港科技大学', shortName:'HKUST', country:'HK', region:'香港', major:'CS', rank:'QS #47', minGpa:3.0, avgGpa:3.4, toefl:80, gre:'不需要', tier:'match', deadline:'3月底', tuition:'港币16万/年', duration:'1年', highlight:'IT 类项目，转专业友好', selectivityBand:'mid' },
  // ---- UK CS ----
  { id:9, school:'University of Cambridge', shortName:'Cambridge', country:'UK', region:'英国', major:'CS', rank:'QS #2', minGpa:3.7, avgGpa:3.85, toefl:110, gre:'不需要', tier:'reach', deadline:'12月5日', tuition:'£40,000/年', duration:'1年', highlight:'极少录取，需研究背景', selectivityBand:'elite' },
  { id:10, school:'Imperial College London', shortName:'IC', country:'UK', region:'英国', major:'CS', rank:'QS #6', minGpa:3.5, avgGpa:3.7, toefl:100, gre:'不需要', tier:'reach', deadline:'1月15日', tuition:'£38,000/年', duration:'1年', highlight:'英国 CS Top2，工科强校', selectivityBand:'elite' },
  { id:11, school:'University of Edinburgh', shortName:'Edinburgh', country:'UK', region:'英国', major:'CS', rank:'QS #27', minGpa:3.2, avgGpa:3.5, toefl:92, gre:'不需要', tier:'match', deadline:'2月1日', tuition:'£35,000/年', duration:'1年', highlight:'AI 方向欧洲领先', selectivityBand:'mid' },
  { id:12, school:"King's College London", shortName:'KCL', country:'UK', region:'英国', major:'CS', rank:'QS #40', minGpa:3.0, avgGpa:3.3, toefl:85, gre:'不需要', tier:'safety', deadline:'滚动录取', tuition:'£32,000/年', duration:'1年', highlight:'伦敦地区，实习资源好', selectivityBand:'friendly' },
  // ---- US MKT ----
  { id:13, school:'Northwestern University', shortName:'Northwestern', country:'US', region:'美国', major:'MKT', rank:'US #6', minGpa:3.3, avgGpa:3.6, toefl:100, gre:'320+', tier:'reach', deadline:'1月10日', tuition:'$70,000/年', duration:'15个月', highlight:'IMC 项目全美第一', selectivityBand:'elite' },
  { id:14, school:'New York University', shortName:'NYU', country:'US', region:'美国', major:'MKT', rank:'US #25', minGpa:3.0, avgGpa:3.4, toefl:100, gre:'315+', tier:'match', deadline:'2月15日', tuition:'$72,000/年', duration:'1-2年', highlight:'纽约 4A 实习资源丰富', selectivityBand:'high' },
  { id:15, school:'Boston University', shortName:'BU', country:'US', region:'美国', major:'MKT', rank:'US #43', minGpa:3.0, avgGpa:3.3, toefl:84, gre:'可选', tier:'match', deadline:'3月15日', tuition:'$60,000/年', duration:'1年', highlight:'MKT+BA 复合方向', selectivityBand:'mid' },
  // ---- HK MKT ----
  { id:16, school:'香港大学', shortName:'HKU', country:'HK', region:'香港', major:'MKT', rank:'QS #17', minGpa:3.2, avgGpa:3.5, toefl:97, gre:'GMAT 650+', tier:'reach', deadline:'1月31日', tuition:'港币32万/年', duration:'1年', highlight:'商学院顶配，GMAT 必须', selectivityBand:'high' },
  { id:17, school:'香港中文大学', shortName:'CUHK', country:'HK', region:'香港', major:'MKT', rank:'QS #36', minGpa:3.0, avgGpa:3.4, toefl:90, gre:'可选 GMAT', tier:'match', deadline:'2月28日', tuition:'港币32万/年', duration:'1年', highlight:'港中文商学院，中港 networking', selectivityBand:'mid' },
  { id:18, school:'香港城市大学', shortName:'CityU', country:'HK', region:'香港', major:'MKT', rank:'QS #62', minGpa:2.8, avgGpa:3.2, toefl:79, gre:'不需要', tier:'safety', deadline:'5月31日', tuition:'港币20万/年', duration:'1年', highlight:'录取友好，无需 GMAT', selectivityBand:'friendly' },
  // ---- UK MKT ----
  { id:19, school:'London School of Economics', shortName:'LSE', country:'UK', region:'英国', major:'MKT', rank:'QS #45', minGpa:3.5, avgGpa:3.7, toefl:107, gre:'GMAT 650+', tier:'reach', deadline:'1月15日', tuition:'£37,000/年', duration:'1年', highlight:'G5 商科，极看重本科背景', selectivityBand:'elite' },
  { id:20, school:'University of Manchester', shortName:'Manchester', country:'UK', region:'英国', major:'MKT', rank:'QS #34', minGpa:3.2, avgGpa:3.4, toefl:100, gre:'不需要', tier:'match', deadline:'滚动录取', tuition:'£32,000/年', duration:'1年', highlight:'分批审理，中国学生多', selectivityBand:'mid' },
  { id:21, school:'University of Warwick', shortName:'Warwick', country:'UK', region:'英国', major:'MKT', rank:'QS #67', minGpa:3.0, avgGpa:3.3, toefl:100, gre:'不需要', tier:'safety', deadline:'滚动录取', tuition:'£33,000/年', duration:'1年', highlight:'WBS 商学院，综合排名靠前', selectivityBand:'friendly' },
];

// 档位配置
const TIER_CONFIG = {
  reach:  { label:'冲刺', desc:'录取概率 10%-30%', icon:'rocket', prob:'10%-30%' },
  match:  { label:'匹配', desc:'录取概率 30%-70%', icon:'focus', prob:'30%-70%' },
  safety: { label:'保底', desc:'录取概率 >70%', icon:'shield', prob:'>70%' },
};

module.exports = {
  PROGRAMS: PROGRAMS,
  TIER_CONFIG: TIER_CONFIG
};
