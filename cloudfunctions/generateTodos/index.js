// 云函数：generateTodos - 根据用户短板生成个性化 TODO
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const res = await db.collection('users').where({
    _openid: OPENID
  }).get()

  if (res.data.length === 0) {
    return { thisWeek: [], thisMonth: [], thisQuarter: [] }
  }

  const profile = res.data[0].profile || {}

  const todos = {
    thisWeek: [],
    thisMonth: [],
    thisQuarter: []
  }

  // 根据短板生成 TODO
  // GRE 短板
  if (!profile.gre || profile.gre === 0) {
    todos.thisWeek.push({
      id: 'tw_gre_1',
      text: '注册 GRE 考试场次，开始 8 周备考计划',
      time: '1 小时',
      impact: '标化 +25'
    })
    todos.thisMonth.push({
      id: 'tm_gre_1',
      text: '完成 GRE 单词第一轮背诵 +  Verbal 基础题型练习',
      checked: false
    })
    todos.thisQuarter.push({
      id: 'tq_gre_1',
      text: 'GRE 出分 ≥ 320',
      checked: false
    })
  }

  // 科研短板
  const researchCount = (profile.research || []).length
  if (researchCount < 2) {
    todos.thisWeek.push({
      id: 'tw_research_1',
      text: researchCount === 0
        ? '邮件联系本校教授，询问是否可以加入实验室做 RA'
        : '整理已有科研成果，联系海外教授寻找暑研机会',
      time: '30 分钟',
      impact: '科研 +12'
    })
    todos.thisQuarter.push({
      id: 'tq_research_1',
      text: researchCount === 0 ? '完成一段科研项目，争取产出' : '暑研产出至少 1 篇 workshop paper',
      checked: false
    })
  }

  // TOEFL 短板
  if (!profile.toefl || profile.toefl < 100) {
    todos.thisWeek.push({
      id: 'tw_toefl_1',
      text: '制定 TOEFL 备考计划，报名最近场次',
      time: '30 分钟',
      impact: '语言 +10'
    })
    todos.thisMonth.push({
      id: 'tm_toefl_1',
      text: profile.toefl && profile.toefl >= 90
        ? 'TOEFL 冲刺，目标 105+'
        : 'TOEFL 基础强化，目标 90+',
      checked: false
    })
  }

  // 实习短板
  const internCount = (profile.internships || []).length
  if (internCount < 2) {
    todos.thisWeek.push({
      id: 'tw_intern_1',
      text: '更新简历，开始投递暑期实习',
      time: '2 小时',
      impact: '实习 +5'
    })
    todos.thisQuarter.push({
      id: 'tq_intern_1',
      text: '完成一段高质量实习',
      checked: false
    })
  }

  // 通用 TODO（不管短板都推荐）
  todos.thisMonth.push({
    id: 'tm_general_1',
    text: '撰写第一版 SoP 框架',
    checked: false
  })
  todos.thisMonth.push({
    id: 'tm_general_2',
    text: '整理选校清单，确认各项目 DDL',
    checked: false
  })

  return todos
}
