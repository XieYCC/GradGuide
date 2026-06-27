// 云函数：compareProfile - 传入 profile，返回与目标档位的差距分析
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 计算用户各维度的分数（0-100）
function calcUserDimension(profile) {
  const schoolRank = {
    '985 · C9 联盟': 95, '985': 85, '211': 75,
    '双一流': 70, '海外本科': 80, '中外合办': 75,
    '双非一本': 60, '双非二本': 50
  }
  const gpaScore = profile.gpa ? Math.min(100, ((profile.gpa - 2.0) / 2.0) * 100) : 0
  const toeflScore = profile.toefl ? Math.min(100, ((profile.toefl - 60) / 60) * 100) : 0
  const greScore = profile.gre ? Math.min(100, ((profile.gre - 260) / 80) * 100) : 0
  const researchScore = Math.min(100, (profile.research || []).length * 35)
  const internScore = Math.min(100, (profile.internships || []).length * 30)
  const recoScore = Math.min(100, (profile.recommendation || []).length * 25)

  return {
    院校背景: schoolRank[profile.schoolLevel] || 70,
    GPA: Math.round(gpaScore),
    语言: Math.round(toeflScore),
    标化: Math.round(greScore),
    实习: Math.round(internScore),
    科研: Math.round(researchScore),
    推荐信: Math.round(recoScore)
  }
}

exports.main = async (event, context) => {
  const { profile } = event

  if (!profile) {
    return { code: -1, message: 'profile 不能为空' }
  }

  // 获取基准数据
  const benchRes = await db.collection('benchmarks').get()
  const benchMap = {}
  benchRes.data.forEach(item => {
    const labels = item.labels || ['院校背景','GPA','语言','标化','实习','科研','推荐信']
    benchMap[item.tier] = {}
    labels.forEach((label, i) => {
      benchMap[item.tier][label] = item.dimensions[i]
    })
  })

  // 计算用户各维度分数
  const userDim = calcUserDimension(profile)

  // 计算与各档位的差距
  const result = {}
  for (const tier of ['reach', 'match', 'safety']) {
    const bench = benchMap[tier]
    if (!bench) continue

    const dimensions = []
    let totalGap = 0
    let maxGap = 0
    let worstDim = ''

    for (const label of Object.keys(userDim)) {
      const userVal = userDim[label]
      const benchVal = bench[label] || 50
      const gap = userVal - benchVal
      totalGap += gap
      if (gap < maxGap) {
        maxGap = gap
        worstDim = label
      }
      dimensions.push({
        name: label,
        userValue: userVal,
        benchValue: benchVal,
        gap: gap,
        status: gap >= 5 ? '优势' : gap >= -5 ? '持平' : '短板'
      })
    }

    result[tier] = {
      dimensions,
      avgGap: Math.round(totalGap / dimensions.length),
      worstDimension: worstDim,
      worstGap: maxGap,
      overallFit: totalGap >= 0 ? '达标' : '有差距'
    }
  }

  return { code: 0, data: result }
}
