/**
 * QS 2026 Top 200 学校数据生成脚本
 *
 * 运行: node scripts/generate-programs.js
 * 输出: programs 数组 JSON，可直接用于 migrateData 云函数
 *
 * 字段填充逻辑：
 * - tier + selectivityBand: QS 1-20→reach+elite, 21-50→reach+high, 51-100→match+mid, 101-150→match+friendly, 151-200→safety+friendly
 * - minGpa/avgGpa: elite→3.7/3.85, high→3.3/3.6, mid→3.0/3.5, friendly→2.8/3.3
 * - toefl: elite→100-110, high→95-105, mid→85-95, friendly→79-85
 * - gre: US需要GRE, UK/HK/SG/EU不需要或可选
 * - deadline: 基于地区典型截止日期
 * - tuition: 基于国家+档次
 * - duration: US→1.5-2年, UK/HK/SG→1年, CA/AU→1-2年, EU→1-2年
 */

// ============================================================
// QS 2026 Top 200 学校列表（仅含热门留学国家）
// 数据来源: QS World University Rankings 2026 (topuniversities.com)
// ============================================================

const QS_SCHOOLS = [
  // ---- US ----
  { rank:1, name:'Massachusetts Institute of Technology (MIT)', shortName:'MIT', country:'US', type:'tech' },
  { rank:3, name:'Stanford University', shortName:'Stanford', country:'US', type:'tech' },
  { rank:5, name:'Harvard University', shortName:'Harvard', country:'US', type:'comprehensive' },
  { rank:6, name:'California Institute of Technology (Caltech)', shortName:'Caltech', country:'US', type:'tech' },
  { rank:10, name:'University of Chicago', shortName:'UChicago', country:'US', type:'comprehensive' },
  { rank:13, name:'University of Pennsylvania', shortName:'UPenn', country:'US', type:'comprehensive' },
  { rank:14, name:'Yale University', shortName:'Yale', country:'US', type:'comprehensive' },
  { rank:19, name:'Columbia University', shortName:'Columbia', country:'US', type:'comprehensive' },
  { rank:20, name:'Princeton University', shortName:'Princeton', country:'US', type:'comprehensive' },
  { rank:21, name:'Cornell University', shortName:'Cornell', country:'US', type:'comprehensive' },
  { rank:23, name:'University of Michigan-Ann Arbor', shortName:'UMich', country:'US', type:'comprehensive' },
  { rank:25, name:'Johns Hopkins University', shortName:'JHU', country:'US', type:'comprehensive' },
  { rank:30, name:'Northwestern University', shortName:'Northwestern', country:'US', type:'comprehensive' },
  { rank:32, name:'University of California, Berkeley (UCB)', shortName:'UC Berkeley', country:'US', type:'tech' },
  { rank:40, name:'University of California, Los Angeles (UCLA)', shortName:'UCLA', country:'US', type:'comprehensive' },
  { rank:42, name:'New York University (NYU)', shortName:'NYU', country:'US', type:'comprehensive' },
  { rank:48, name:'University of California, San Diego (UCSD)', shortName:'UCSD', country:'US', type:'tech' },
  { rank:52, name:'Duke University', shortName:'Duke', country:'US', type:'comprehensive' },
  { rank:53, name:'Carnegie Mellon University', shortName:'CMU', country:'US', type:'tech' },
  { rank:60, name:'Brown University', shortName:'Brown', country:'US', type:'comprehensive' },
  { rank:67, name:'University of Texas at Austin', shortName:'UT Austin', country:'US', type:'comprehensive' },
  { rank:75, name:'University of Wisconsin-Madison', shortName:'UW Madison', country:'US', type:'comprehensive' },
  { rank:82, name:'University of Illinois at Urbana-Champaign', shortName:'UIUC', country:'US', type:'tech' },
  { rank:85, name:'University of Washington', shortName:'UW', country:'US', type:'tech' },
  { rank:88, name:'Georgia Institute of Technology', shortName:'Georgia Tech', country:'US', type:'tech' },
  { rank:94, name:'Rice University', shortName:'Rice', country:'US', type:'comprehensive' },
  { rank:96, name:'Pennsylvania State University', shortName:'Penn State', country:'US', type:'comprehensive' },
  { rank:100, name:'University of North Carolina at Chapel Hill', shortName:'UNC', country:'US', type:'comprehensive' },
  { rank:107, name:'Washington University in St. Louis', shortName:'WashU', country:'US', type:'comprehensive' },
  { rank:108, name:'University of California, Davis', shortName:'UC Davis', country:'US', type:'comprehensive' },
  { rank:112, name:'Boston University', shortName:'BU', country:'US', type:'comprehensive' },
  { rank:112, name:'University of Southern California', shortName:'USC', country:'US', type:'comprehensive' },
  { rank:116, name:'Purdue University', shortName:'Purdue', country:'US', type:'tech' },
  { rank:120, name:'The Ohio State University', shortName:'OSU', country:'US', type:'comprehensive' },
  { rank:146, name:'University of California, Santa Barbara (UCSB)', shortName:'UCSB', country:'US', type:'comprehensive' },
  { rank:154, name:'University of Rochester', shortName:'Rochester', country:'US', type:'comprehensive' },
  { rank:157, name:'Michigan State University', shortName:'MSU', country:'US', type:'comprehensive' },
  { rank:158, name:'University of Maryland, College Park', shortName:'UMD', country:'US', type:'comprehensive' },
  { rank:160, name:'Emory University', shortName:'Emory', country:'US', type:'comprehensive' },
  { rank:161, name:'Case Western Reserve University', shortName:'CWRU', country:'US', type:'comprehensive' },
  { rank:163, name:'University of Pittsburgh', shortName:'Pitt', country:'US', type:'comprehensive' },
  { rank:168, name:'Texas A&M University', shortName:'TAMU', country:'US', type:'comprehensive' },
  { rank:173, name:'University of Florida', shortName:'UF', country:'US', type:'comprehensive' },
  { rank:186, name:'University of Minnesota Twin Cities', shortName:'UMN', country:'US', type:'comprehensive' },
  { rank:191, name:'Dartmouth College', shortName:'Dartmouth', country:'US', type:'comprehensive' },
  { rank:216, name:'Arizona State University', shortName:'ASU', country:'US', type:'comprehensive' },
  { rank:218, name:'Vanderbilt University', shortName:'Vanderbilt', country:'US', type:'comprehensive' },
  { rank:222, name:'University of Notre Dame', shortName:'Notre Dame', country:'US', type:'comprehensive' },
  { rank:226, name:'University of Virginia', shortName:'UVA', country:'US', type:'comprehensive' },
  { rank:232, name:'University of California, Irvine', shortName:'UC Irvine', country:'US', type:'comprehensive' },
  { rank:246, name:'University of Massachusetts Amherst', shortName:'UMass Amherst', country:'US', type:'comprehensive' },
  { rank:248, name:'Georgetown University', shortName:'Georgetown', country:'US', type:'comprehensive' },
  { rank:251, name:'University of Colorado Boulder', shortName:'CU Boulder', country:'US', type:'comprehensive' },
  { rank:264, name:'Rutgers University–New Brunswick', shortName:'Rutgers', country:'US', type:'comprehensive' },
  { rank:275, name:'Tufts University', shortName:'Tufts', country:'US', type:'comprehensive' },
  { rank:300, name:'North Carolina State University', shortName:'NC State', country:'US', type:'tech' },
  { rank:311, name:'Indiana University Bloomington', shortName:'IU Bloomington', country:'US', type:'comprehensive' },
  { rank:342, name:'Northeastern University', shortName:'NEU', country:'US', type:'comprehensive' },
  { rank:346, name:'Virginia Polytechnic Institute', shortName:'Virginia Tech', country:'US', type:'tech' },
  { rank:355, name:'George Washington University', shortName:'GWU', country:'US', type:'comprehensive' },
  { rank:358, name:'University of Utah', shortName:'Utah', country:'US', type:'comprehensive' },
  { rank:373, name:'University of Connecticut', shortName:'UConn', country:'US', type:'comprehensive' },
  { rank:378, name:'Stony Brook University', shortName:'SBU', country:'US', type:'comprehensive' },
  { rank:431, name:'Rensselaer Polytechnic Institute', shortName:'RPI', country:'US', type:'tech' },
  { rank:444, name:'Illinois Institute of Technology', shortName:'IIT', country:'US', type:'tech' },
  { rank:461, name:'Colorado School of Mines', shortName:'Mines', country:'US', type:'tech' },
  { rank:475, name:'Florida State University', shortName:'FSU', country:'US', type:'comprehensive' },
  { rank:476, name:'University of Missouri, Columbia', shortName:'Mizzou', country:'US', type:'comprehensive' },
  { rank:477, name:'University of Texas Dallas', shortName:'UT Dallas', country:'US', type:'comprehensive' },
  { rank:494, name:'Iowa State University', shortName:'ISU', country:'US', type:'tech' },
  { rank:531, name:'Lehigh University', shortName:'Lehigh', country:'US', type:'comprehensive' },
  { rank:541, name:'The University of Georgia', shortName:'UGA', country:'US', type:'comprehensive' },
  { rank:541, name:'The University of Tennessee, Knoxville', shortName:'UT Knoxville', country:'US', type:'comprehensive' },
  { rank:701, name:'Stevens Institute of Technology', shortName:'Stevens', country:'US', type:'tech' },
  { rank:701, name:'New Jersey Institute of Technology (NJIT)', shortName:'NJIT', country:'US', type:'tech' },

  // ---- UK ----
  { rank:2, name:'University of Oxford', shortName:'Oxford', country:'UK', type:'comprehensive' },
  { rank:3, name:'University of Cambridge', shortName:'Cambridge', country:'UK', type:'comprehensive' },
  { rank:7, name:'Imperial College London', shortName:'IC', country:'UK', type:'tech' },
  { rank:8, name:'UCL', shortName:'UCL', country:'UK', type:'comprehensive' },
  { rank:16, name:'The University of Edinburgh', shortName:'Edinburgh', country:'UK', type:'comprehensive' },
  { rank:27, name:'The University of Manchester', shortName:'Manchester', country:'UK', type:'comprehensive' },
  { rank:35, name:"King's College London", shortName:'KCL', country:'UK', type:'comprehensive' },
  { rank:49, name:'The London School of Economics and Political Science (LSE)', shortName:'LSE', country:'UK', type:'business' },
  { rank:61, name:'The University of Warwick', shortName:'Warwick', country:'UK', type:'comprehensive' },
  { rank:62, name:'University of Bristol', shortName:'Bristol', country:'UK', type:'comprehensive' },
  { rank:73, name:'University of Glasgow', shortName:'Glasgow', country:'UK', type:'comprehensive' },
  { rank:77, name:'University of Southampton', shortName:'Southampton', country:'UK', type:'comprehensive' },
  { rank:82, name:'Durham University', shortName:'Durham', country:'UK', type:'comprehensive' },
  { rank:90, name:'University of Birmingham', shortName:'Birmingham', country:'UK', type:'comprehensive' },
  { rank:91, name:'University of St Andrews', shortName:'St Andrews', country:'UK', type:'comprehensive' },
  { rank:92, name:'University of Leeds', shortName:'Leeds', country:'UK', type:'comprehensive' },
  { rank:95, name:'The University of Sheffield', shortName:'Sheffield', country:'UK', type:'comprehensive' },
  { rank:103, name:'University of Nottingham', shortName:'Nottingham', country:'UK', type:'comprehensive' },
  { rank:117, name:'Queen Mary University of London', shortName:'QMUL', country:'UK', type:'comprehensive' },
  { rank:132, name:'Lancaster University', shortName:'Lancaster', country:'UK', type:'comprehensive' },
  { rank:134, name:'Newcastle University', shortName:'Newcastle', country:'UK', type:'comprehensive' },
  { rank:149, name:'University of Exeter', shortName:'Exeter', country:'UK', type:'comprehensive' },
  { rank:151, name:'Cardiff University', shortName:'Cardiff', country:'UK', type:'comprehensive' },
  { rank:151, name:'University of York', shortName:'York', country:'UK', type:'comprehensive' },
  { rank:166, name:'University of Bath', shortName:'Bath', country:'UK', type:'comprehensive' },
  { rank:189, name:'University of Liverpool', shortName:'Liverpool', country:'UK', type:'comprehensive' },

  // ---- HK ----
  { rank:22, name:'The University of Hong Kong', shortName:'HKU', country:'HK', type:'comprehensive' },
  { rank:34, name:'The Hong Kong University of Science and Technology', shortName:'HKUST', country:'HK', type:'tech' },
  { rank:39, name:'The Chinese University of Hong Kong (CUHK)', shortName:'CUHK', country:'HK', type:'comprehensive' },
  { rank:53, name:'City University of Hong Kong', shortName:'CityU', country:'HK', type:'comprehensive' },
  { rank:66, name:'The Hong Kong Polytechnic University', shortName:'PolyU', country:'HK', type:'tech' },

  // ---- Singapore ----
  { rank:11, name:'National University of Singapore (NUS)', shortName:'NUS', country:'SG', type:'comprehensive' },
  { rank:12, name:'Nanyang Technological University, Singapore (NTU Singapore)', shortName:'NTU', country:'SG', type:'tech' },

  // ---- Canada ----
  { rank:26, name:'University of Toronto', shortName:'UofT', country:'CA', type:'comprehensive' },
  { rank:27, name:'McGill University', shortName:'McGill', country:'CA', type:'comprehensive' },
  { rank:46, name:'University of British Columbia', shortName:'UBC', country:'CA', type:'comprehensive' },
  { rank:111, name:'Université de Montréal', shortName:'UdeM', country:'CA', type:'comprehensive' },
  { rank:126, name:'University of Alberta', shortName:'Alberta', country:'CA', type:'comprehensive' },
  { rank:140, name:'McMaster University', shortName:'McMaster', country:'CA', type:'comprehensive' },
  { rank:149, name:'University of Waterloo', shortName:'Waterloo', country:'CA', type:'tech' },
  { rank:170, name:'Western University', shortName:'Western', country:'CA', type:'comprehensive' },
  { rank:230, name:'University of Ottawa', shortName:'uOttawa', country:'CA', type:'comprehensive' },
  { rank:235, name:'University of Calgary', shortName:'Calgary', country:'CA', type:'comprehensive' },
  { rank:240, name:"Queen's University at Kingston", shortName:"Queen's", country:'CA', type:'comprehensive' },
  { rank:298, name:'Simon Fraser University', shortName:'SFU', country:'CA', type:'comprehensive' },
  { rank:334, name:'University of Victoria (UVic)', shortName:'UVic', country:'CA', type:'comprehensive' },

  // ---- Australia ----
  { rank:27, name:'Australian National University (ANU)', shortName:'ANU', country:'AU', type:'comprehensive' },
  { rank:37, name:'The University of Melbourne', shortName:'UniMelb', country:'AU', type:'comprehensive' },
  { rank:38, name:'The University of Sydney', shortName:'USyd', country:'AU', type:'comprehensive' },
  { rank:43, name:'The University of New South Wales (UNSW Sydney)', shortName:'UNSW', country:'AU', type:'comprehensive' },
  { rank:47, name:'The University of Queensland', shortName:'UQ', country:'AU', type:'comprehensive' },
  { rank:58, name:'Monash University', shortName:'Monash', country:'AU', type:'comprehensive' },
  { rank:93, name:'The University of Western Australia', shortName:'UWA', country:'AU', type:'comprehensive' },
  { rank:108, name:'The University of Adelaide', shortName:'Adelaide', country:'AU', type:'comprehensive' },
  { rank:133, name:'University of Technology Sydney', shortName:'UTS', country:'AU', type:'tech' },
  { rank:193, name:'University of Wollongong', shortName:'UOW', country:'AU', type:'comprehensive' },
  { rank:194, name:'Curtin University', shortName:'Curtin', country:'AU', type:'comprehensive' },
  { rank:197, name:'The University of Newcastle, Australia (UON)', shortName:'Newcastle', country:'AU', type:'comprehensive' },
  { rank:200, name:'Macquarie University', shortName:'Macquarie', country:'AU', type:'comprehensive' },
  { rank:206, name:'RMIT University', shortName:'RMIT', country:'AU', type:'tech' },
  { rank:213, name:'Queensland University of Technology (QUT)', shortName:'QUT', country:'AU', type:'tech' },

  // ---- Germany ----
  { rank:50, name:'Technical University of Munich', shortName:'TUM', country:'DE', type:'tech' },
  { rank:63, name:'Universität Heidelberg', shortName:'Heidelberg', country:'DE', type:'comprehensive' },
  { rank:64, name:'Ludwig-Maximilians-Universität München', shortName:'LMU Munich', country:'DE', type:'comprehensive' },
  { rank:127, name:'Freie Universitaet Berlin', shortName:'FU Berlin', country:'DE', type:'comprehensive' },
  { rank:128, name:'Humboldt-Universität zu Berlin', shortName:'HU Berlin', country:'DE', type:'comprehensive' },
  { rank:136, name:'KIT, Karlsruhe Institute of Technology', shortName:'KIT', country:'DE', type:'tech' },
  { rank:159, name:'Technische Universität Berlin (TU Berlin)', shortName:'TU Berlin', country:'DE', type:'tech' },
  { rank:165, name:'RWTH Aachen University', shortName:'RWTH Aachen', country:'DE', type:'tech' },
  { rank:172, name:'Albert-Ludwigs-Universitaet Freiburg', shortName:'Freiburg', country:'DE', type:'comprehensive' },
  { rank:177, name:'Eberhard Karls Universität Tübingen', shortName:'Tübingen', country:'DE', type:'comprehensive' },
  { rank:194, name:'Technische Universität Dresden', shortName:'TU Dresden', country:'DE', type:'tech' },
  { rank:269, name:'Technical University of Darmstadt', shortName:'TU Darmstadt', country:'DE', type:'tech' },
  { rank:311, name:'University of Cologne', shortName:'Cologne', country:'DE', type:'comprehensive' },

  // ---- Switzerland ----
  { rank:8, name:'ETH Zurich', shortName:'ETH Zurich', country:'CH', type:'tech' },
  { rank:14, name:'EPFL', shortName:'EPFL', country:'CH', type:'tech' },
  { rank:70, name:'University of Zurich', shortName:'UZH', country:'CH', type:'comprehensive' },
  { rank:105, name:'University of Geneva', shortName:'UNIGE', country:'CH', type:'comprehensive' },
  { rank:119, name:'University of Bern', shortName:'Bern', country:'CH', type:'comprehensive' },
  { rank:138, name:'University of Basel', shortName:'Basel', country:'CH', type:'comprehensive' },
  { rank:176, name:'University of Lausanne', shortName:'UNIL', country:'CH', type:'comprehensive' },

  // ---- Netherlands ----
  { rank:55, name:'University of Amsterdam', shortName:'UvA', country:'NL', type:'comprehensive' },
  { rank:57, name:'Delft University of Technology', shortName:'TU Delft', country:'NL', type:'tech' },
  { rank:110, name:'Utrecht University', shortName:'Utrecht', country:'NL', type:'comprehensive' },
  { rank:112, name:'Leiden University', shortName:'Leiden', country:'NL', type:'comprehensive' },
  { rank:123, name:'Wageningen University & Research', shortName:'WUR', country:'NL', type:'tech' },
  { rank:125, name:'Eindhoven University of Technology', shortName:'TU/e', country:'NL', type:'tech' },
  { rank:128, name:'University of Groningen', shortName:'Groningen', country:'NL', type:'comprehensive' },
  { rank:179, name:'Erasmus University Rotterdam', shortName:'EUR', country:'NL', type:'business' },
  { rank:189, name:'University of Twente', shortName:'Twente', country:'NL', type:'tech' },
  { rank:209, name:'Vrije Universiteit Amsterdam', shortName:'VU Amsterdam', country:'NL', type:'comprehensive' },

  // ---- France ----
  { rank:44, name:'Université PSL', shortName:'PSL', country:'FR', type:'comprehensive' },
  { rank:49, name:'Institut Polytechnique de Paris', shortName:'IP Paris', country:'FR', type:'tech' },
  { rank:72, name:'Sorbonne University', shortName:'Sorbonne', country:'FR', type:'comprehensive' },
  { rank:86, name:'Université Paris-Saclay', shortName:'Paris-Saclay', country:'FR', type:'comprehensive' },
  { rank:130, name:'École Normale Supérieure de Lyon', shortName:'ENS Lyon', country:'FR', type:'comprehensive' },

  // ---- Japan ----
  { rank:23, name:'The University of Tokyo', shortName:'UTokyo', country:'JP', type:'comprehensive' },
  { rank:33, name:'Kyoto University', shortName:'Kyoto', country:'JP', type:'comprehensive' },
  { rank:56, name:'Tokyo Institute of Technology (Tokyo Tech)', shortName:'Tokyo Tech', country:'JP', type:'tech' },
  { rank:75, name:'Osaka University', shortName:'Osaka', country:'JP', type:'comprehensive' },
  { rank:82, name:'Tohoku University', shortName:'Tohoku', country:'JP', type:'comprehensive' },
  { rank:118, name:'Nagoya University', shortName:'Nagoya', country:'JP', type:'comprehensive' },
  { rank:137, name:'Kyushu University', shortName:'Kyushu', country:'JP', type:'comprehensive' },
  { rank:145, name:'Hokkaido University', shortName:'Hokkaido', country:'JP', type:'comprehensive' },
  { rank:201, name:'Keio University', shortName:'Keio', country:'JP', type:'comprehensive' },
  { rank:203, name:'Waseda University', shortName:'Waseda', country:'JP', type:'comprehensive' },

  // ---- South Korea ----
  { rank:36, name:'Seoul National University', shortName:'SNU', country:'KR', type:'comprehensive' },
  { rank:41, name:'KAIST - Korea Advanced Institute of Science & Technology', shortName:'KAIST', country:'KR', type:'tech' },
  { rank:74, name:'Korea University', shortName:'Korea', country:'KR', type:'comprehensive' },
  { rank:79, name:'Yonsei University', shortName:'Yonsei', country:'KR', type:'comprehensive' },
  { rank:81, name:'Pohang University of Science And Technology (POSTECH)', shortName:'POSTECH', country:'KR', type:'tech' },
  { rank:97, name:'Sungkyunkwan University (SKKU)', shortName:'SKKU', country:'KR', type:'comprehensive' },
  { rank:156, name:'Hanyang University', shortName:'Hanyang', country:'KR', type:'comprehensive' },
];

// ============================================================
// 专业定义 & 学校-专业映射
// ============================================================

const MAJORS = {
  CS: 'CS',
  DS: 'DS',
  EE: 'EE',
  MKT: 'MKT',
  BA: 'BA',
  Finance: 'Finance',
};

/**
 * 根据学校类型和排名决定开设哪些专业的硕士项目
 * - tech: 科技类强校 → CS, DS, EE 一定有; BA 部分有; MKT/Finance 部分有
 * - comprehensive: 综合大学 → 6个专业基本都有
 * - business: 商科强校 → MKT, BA, Finance 一定有; CS/DS/EE 可能没有
 */
function getSchoolMajors(school) {
  const type = school.type;
  const rank = school.rank;

  switch (type) {
    case 'tech':
      // 科技强校：CS, DS, EE 必有；BA 大部分有；MKT/Finance 顶级才有
      if (rank <= 50) {
        return [MAJORS.CS, MAJORS.DS, MAJORS.EE, MAJORS.BA, MAJORS.MKT, MAJORS.Finance];
      }
      if (rank <= 150) {
        return [MAJORS.CS, MAJORS.DS, MAJORS.EE, MAJORS.BA];
      }
      return [MAJORS.CS, MAJORS.DS, MAJORS.EE];

    case 'business':
      // 商科强校：MKT, BA, Finance 必有
      if (rank <= 100) {
        return [MAJORS.MKT, MAJORS.BA, MAJORS.Finance, MAJORS.CS, MAJORS.DS];
      }
      return [MAJORS.MKT, MAJORS.BA, MAJORS.Finance];

    case 'comprehensive':
    default:
      // 综合大学：基本都有
      if (rank <= 30) {
        return [MAJORS.CS, MAJORS.DS, MAJORS.EE, MAJORS.MKT, MAJORS.BA, MAJORS.Finance];
      }
      if (rank <= 100) {
        return [MAJORS.CS, MAJORS.DS, MAJORS.EE, MAJORS.MKT, MAJORS.BA, MAJORS.Finance];
      }
      if (rank <= 200) {
        return [MAJORS.CS, MAJORS.DS, MAJORS.EE, MAJORS.BA, MAJORS.Finance];
      }
      return [MAJORS.CS, MAJORS.DS, MAJORS.BA, MAJORS.Finance];
  }
}

// ============================================================
// 国家-地区映射
// ============================================================

const COUNTRY_REGION_MAP = {
  US: { region: '美国', currency: '$', currencyLabel: '$', tuitionRange: { elite:'$70,000/年', high:'$60,000/年', mid:'$50,000/年', friendly:'$40,000/年' } },
  UK: { region: '英国', currency: '£', currencyLabel: '£', tuitionRange: { elite:'£40,000/年', high:'£35,000/年', mid:'£30,000/年', friendly:'£25,000/年' } },
  HK: { region: '香港', currency: '港币', currencyLabel: '港币', tuitionRange: { elite:'港币32万/年', high:'港币25万/年', mid:'港币18万/年', friendly:'港币15万/年' } },
  CA: { region: '加拿大', currency: 'CAD ', currencyLabel: 'CAD', tuitionRange: { elite:'CAD 55,000/年', high:'CAD 45,000/年', mid:'CAD 35,000/年', friendly:'CAD 28,000/年' } },
  AU: { region: '澳大利亚', currency: 'AUD ', currencyLabel: 'AUD', tuitionRange: { elite:'AUD 52,000/年', high:'AUD 45,000/年', mid:'AUD 38,000/年', friendly:'AUD 32,000/年' } },
  SG: { region: '新加坡', currency: 'SGD ', currencyLabel: 'SGD', tuitionRange: { elite:'SGD 45,000/年', high:'SGD 38,000/年', mid:'SGD 32,000/年', friendly:'SGD 28,000/年' } },
  DE: { region: '德国', currency: '€', currencyLabel: '€', tuitionRange: { elite:'€20,000/年', high:'€15,000/年', mid:'€10,000/年', friendly:'€5,000/年' } },
  CH: { region: '瑞士', currency: 'CHF ', currencyLabel: 'CHF', tuitionRange: { elite:'CHF 30,000/年', high:'CHF 25,000/年', mid:'CHF 20,000/年', friendly:'CHF 15,000/年' } },
  NL: { region: '荷兰', currency: '€', currencyLabel: '€', tuitionRange: { elite:'€22,000/年', high:'€18,000/年', mid:'€15,000/年', friendly:'€12,000/年' } },
  FR: { region: '法国', currency: '€', currencyLabel: '€', tuitionRange: { elite:'€18,000/年', high:'€12,000/年', mid:'€8,000/年', friendly:'€5,000/年' } },
  JP: { region: '日本', currency: '¥', currencyLabel: '日元', tuitionRange: { elite:'¥1,200,000/年', high:'¥1,000,000/年', mid:'¥800,000/年', friendly:'¥600,000/年' } },
  KR: { region: '韩国', currency: '₩', currencyLabel: '韩元', tuitionRange: { elite:'₩18,000,000/年', high:'₩14,000,000/年', mid:'₩10,000,000/年', friendly:'₩8,000,000/年' } },
};

// ============================================================
// 字段推算逻辑
// ============================================================

/**
 * QS 排名 → tier + selectivityBand
 */
function getTierAndBand(qsRank) {
  if (qsRank <= 20)  return { tier: 'reach', band: 'elite' };
  if (qsRank <= 50)  return { tier: 'reach', band: 'high' };
  if (qsRank <= 100) return { tier: 'match', band: 'mid' };
  if (qsRank <= 150) return { tier: 'match', band: 'friendly' };
  return { tier: 'safety', band: 'friendly' };
}

/**
 * selectivityBand → GPA
 */
function getGpa(band) {
  const gpaMap = {
    elite:    { minGpa: 3.7, avgGpa: 3.85 },
    high:     { minGpa: 3.3, avgGpa: 3.6 },
    mid:      { minGpa: 3.0, avgGpa: 3.5 },
    friendly: { minGpa: 2.8, avgGpa: 3.3 },
  };
  return gpaMap[band] || gpaMap.friendly;
}

/**
 * selectivityBand → TOEFL
 */
function getToefl(band, country) {
  // 非英语国家 TOEFL 要求可能稍低
  const isEnglishNative = ['US', 'UK', 'CA', 'AU'].includes(country);
  const toeflMap = {
    elite:    isEnglishNative ? 105 : 100,
    high:     isEnglishNative ? 100 : 95,
    mid:      isEnglishNative ? 90 : 85,
    friendly: isEnglishNative ? 85 : 80,
  };
  return toeflMap[band] || 85;
}

/**
 * country + major + tier → GRE 要求
 */
function getGre(country, major, band) {
  // US 学校通常需要 GRE（尤其是 CS/EE/DS）
  if (country === 'US') {
    if (['CS', 'DS', 'EE'].includes(major)) {
      if (band === 'elite') return '325+';
      if (band === 'high') return '320+';
      if (band === 'mid') return '315+';
      return '可选';
    }
    if (['MKT', 'BA', 'Finance'].includes(major)) {
      if (band === 'elite') return 'GMAT 720+';
      if (band === 'high') return 'GMAT 680+';
      if (band === 'mid') return 'GMAT 650+';
      return '可选 GMAT';
    }
  }
  // 非 US 学校大多不需要 GRE
  if (['UK', 'HK', 'SG', 'DE', 'CH', 'NL', 'FR', 'JP', 'KR'].includes(country)) {
    if (band === 'elite' && major === 'Finance') return 'GMAT 700+';
    if (band === 'high' && major === 'Finance') return 'GMAT 650+';
    if (band === 'elite' && ['CS', 'DS'].includes(major)) return '可选';
    return '不需要';
  }
  if (['CA'].includes(country)) {
    if (band === 'elite' && ['CS', 'DS', 'EE'].includes(major)) return '320+';
    return '可选';
  }
  if (['AU'].includes(country)) {
    return '不需要';
  }
  return '不需要';
}

/**
 * country → deadline pattern
 */
function getDeadline(country, band) {
  const patterns = {
    US: { elite:'12月15日', high:'1月15日', mid:'2月1日', friendly:'滚动录取' },
    UK: { elite:'1月15日', high:'1月31日', mid:'滚动录取', friendly:'滚动录取' },
    HK: { elite:'12月31日', high:'1月31日', mid:'2月28日', friendly:'5月31日' },
    CA: { elite:'12月15日', high:'1月31日', mid:'2月15日', friendly:'滚动录取' },
    AU: { elite:'12月1日', high:'1月15日', mid:'滚动录取', friendly:'滚动录取' },
    SG: { elite:'1月15日', high:'2月15日', mid:'3月15日', friendly:'5月31日' },
    DE: { elite:'1月15日', high:'3月15日', mid:'5月31日', friendly:'7月15日' },
    CH: { elite:'12月15日', high:'1月31日', mid:'3月31日', friendly:'4月30日' },
    NL: { elite:'1月15日', high:'3月1日', mid:'5月1日', friendly:'6月1日' },
    FR: { elite:'1月15日', high:'3月15日', mid:'5月15日', friendly:'6月30日' },
    JP: { elite:'12月1日', high:'1月15日', mid:'2月28日', friendly:'5月31日' },
    KR: { elite:'11月30日', high:'1月15日', mid:'3月31日', friendly:'5月31日' },
  };
  return (patterns[country] || patterns.US)[band];
}

/**
 * country → duration
 */
function getDuration(country, major) {
  const short = ['UK', 'HK', 'SG']; // 1年制
  const medium = ['CA', 'AU', 'DE', 'CH', 'NL', 'FR']; // 1-2年
  const long = ['US']; // 1.5-2年
  const jpkr = ['JP', 'KR']; // 2年

  if (short.includes(country)) return '1年';
  if (medium.includes(country)) return '1-2年';
  if (long.includes(country)) {
    if (['MKT', 'BA', 'Finance'].includes(major)) return '1-1.5年';
    return '1.5-2年';
  }
  if (jpkr.includes(country)) return '2年';
  return '1-2年';
}

/**
 * 生成亮点描述
 */
function getHighlight(school, major, band, country) {
  const schoolName = school.shortName || school.name;
  const region = COUNTRY_REGION_MAP[country]?.region || country;

  const highlights = {
    CS: {
      elite: `${schoolName} CS 全球顶尖，研究导向`,
      high: `${schoolName} CS 实力强劲，就业资源丰富`,
      mid: `${schoolName} CS 项目扎实，性价比高`,
      friendly: `${schoolName} CS 录取友好，适合保底`,
    },
    DS: {
      elite: `${schoolName} 数据科学旗舰项目，产学研结合`,
      high: `${schoolName} DS 项目成熟，行业联系紧密`,
      mid: `${schoolName} DS 方向实用，就业导向`,
      friendly: `${schoolName} DS 项目友好，转专业可选`,
    },
    EE: {
      elite: `${schoolName} 电子工程世界领先`,
      high: `${schoolName} EE 实力强劲，硬件方向突出`,
      mid: `${schoolName} EE 项目扎实，工程导向`,
      friendly: `${schoolName} EE 录取友好，适合保底`,
    },
    MKT: {
      elite: `${schoolName} 市场营销顶尖项目`,
      high: `${schoolName} MKT 项目优质，区位优势明显`,
      mid: `${schoolName} MKT 实用导向，就业不错`,
      friendly: `${schoolName} MKT 录取友好，无需 GMAT`,
    },
    BA: {
      elite: `${schoolName} 商业分析旗舰项目`,
      high: `${schoolName} BA 项目知名，企业合作多`,
      mid: `${schoolName} BA 就业导向，性价比高`,
      friendly: `${schoolName} BA 录取友好，适合转专业`,
    },
    Finance: {
      elite: `${schoolName} 金融硕士顶尖，投行 target`,
      high: `${schoolName} 金融项目优质，校友网络强`,
      mid: `${schoolName} 金融项目实用，就业支持好`,
      friendly: `${schoolName} 金融录取友好，性价比之选`,
    },
  };

  return (highlights[major] && highlights[major][band]) || `${schoolName} ${major} 硕士项目，${region}留学热门选择`;
}

// ============================================================
// 主生成逻辑
// ============================================================

function generatePrograms() {
  const programs = [];
  let id = 100; // 从 100 开始，避免和现有 1-21 冲突

  for (const school of QS_SCHOOLS) {
    const { tier, band } = getTierAndBand(school.rank);
    const { minGpa, avgGpa } = getGpa(band);
    const toefl = getToefl(band, school.country);
    const majors = getSchoolMajors(school);
    const countryInfo = COUNTRY_REGION_MAP[school.country] || COUNTRY_REGION_MAP['US'];
    const tuition = countryInfo.tuitionRange[band];

    for (const major of majors) {
      const gre = getGre(school.country, major, band);
      const deadline = getDeadline(school.country, band);
      const duration = getDuration(school.country, major);
      const highlight = getHighlight(school, major, band, school.country);
      const rankDisplay = `QS #${school.rank}`;

      programs.push({
        id: id,
        school: school.name,
        shortName: school.shortName,
        country: school.country,
        region: countryInfo.region,
        major: major,
        rank: rankDisplay,
        minGpa: minGpa,
        avgGpa: avgGpa,
        toefl: toefl,
        gre: gre,
        tier: tier,
        deadline: deadline,
        tuition: tuition,
        duration: duration,
        highlight: highlight,
        selectivityBand: band,
        enabled: true,
      });

      id++;
    }
  }

  return programs;
}

// ============================================================
// 执行 & 输出
// ============================================================

const programs = generatePrograms();

console.log(`// 总计生成 ${programs.length} 条记录\n`);

// 按国家统计
const stats = {};
programs.forEach(p => {
  if (!stats[p.country]) stats[p.country] = { count: 0, majors: {} };
  stats[p.country].count++;
  if (!stats[p.country].majors[p.major]) stats[p.country].majors[p.major] = 0;
  stats[p.country].majors[p.major]++;
});

console.log('// === 统计 ===');
for (const [country, data] of Object.entries(stats)) {
  console.log(`// ${country}: ${data.count} 条, 专业分布: ${JSON.stringify(data.majors)}`);
}
console.log('');

// 输出 JS 数组格式（可直接粘贴到 migrateData/index.js）
console.log('const PROGRAMS = [');
programs.forEach((p, i) => {
  const line = JSON.stringify(p);
  if (i < programs.length - 1) {
    console.log('  ' + line + ',');
  } else {
    console.log('  ' + line);
  }
});
console.log('];');
