// 一次性数据迁移脚本
// 在云开发控制台 → 云函数 → migrateData → 上传并部署 → 测试调用
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const PROGRAMS = [
  { school:'Carnegie Mellon University', shortName:'CMU', country:'US', region:'美国', major:'CS', rank:'US #3', minGpa:3.7, avgGpa:3.85, toefl:100, gre:'325+', tier:'reach', deadline:'12月10日', tuition:'$70,000/年', duration:'16个月', highlight:'CS 全美第一，强调科研背景', enabled: true },
  { school:'Columbia University', shortName:'Columbia', country:'US', region:'美国', major:'CS', rank:'US #12', minGpa:3.3, avgGpa:3.6, toefl:99, gre:'320+', tier:'reach', deadline:'2月15日', tuition:'$65,000/年', duration:'1.5-2年', highlight:'地处纽约，实习资源丰富', enabled: true },
  { school:'University of Southern California', shortName:'USC', country:'US', region:'美国', major:'CS', rank:'US #28', minGpa:3.0, avgGpa:3.5, toefl:90, gre:'315+', tier:'match', deadline:'1月15日', tuition:'$60,000/年', duration:'1.5-2年', highlight:'校友资源强，中国学生多', enabled: true },
  { school:'Northeastern University', shortName:'NEU', country:'US', region:'美国', major:'CS', rank:'US #44', minGpa:3.0, avgGpa:3.4, toefl:90, gre:'可选', tier:'match', deadline:'滚动录取', tuition:'$50,000/年', duration:'2年', highlight:'Co-op 实习项目知名', enabled: true },
  { school:'Stevens Institute of Technology', shortName:'Stevens', country:'US', region:'美国', major:'CS', rank:'US #76', minGpa:2.8, avgGpa:3.3, toefl:80, gre:'可选', tier:'safety', deadline:'滚动录取', tuition:'$45,000/年', duration:'1.5-2年', highlight:'录取友好，性价比高', enabled: true },
  { school:'香港大学', shortName:'HKU', country:'HK', region:'香港', major:'CS', rank:'QS #17', minGpa:3.2, avgGpa:3.6, toefl:90, gre:'可选', tier:'reach', deadline:'1月31日', tuition:'港币18万/年', duration:'1年', highlight:'港校 CS 第一，海归就业好', enabled: true },
  { school:'香港中文大学', shortName:'CUHK', country:'HK', region:'香港', major:'CS', rank:'QS #36', minGpa:3.0, avgGpa:3.5, toefl:79, gre:'不需要', tier:'match', deadline:'2月28日', tuition:'港币16万/年', duration:'1年', highlight:'录取友好，适合冲刺转专业', enabled: true },
  { school:'香港科技大学', shortName:'HKUST', country:'HK', region:'香港', major:'CS', rank:'QS #47', minGpa:3.0, avgGpa:3.4, toefl:80, gre:'不需要', tier:'match', deadline:'3月底', tuition:'港币16万/年', duration:'1年', highlight:'IT 类项目，转专业友好', enabled: true },
  { school:'University of Cambridge', shortName:'Cambridge', country:'UK', region:'英国', major:'CS', rank:'QS #2', minGpa:3.7, avgGpa:3.85, toefl:110, gre:'不需要', tier:'reach', deadline:'12月5日', tuition:'£40,000/年', duration:'1年', highlight:'极少录取，需研究背景', enabled: true },
  { school:'Imperial College London', shortName:'IC', country:'UK', region:'英国', major:'CS', rank:'QS #6', minGpa:3.5, avgGpa:3.7, toefl:100, gre:'不需要', tier:'reach', deadline:'1月15日', tuition:'£38,000/年', duration:'1年', highlight:'英国 CS Top2，工科强校', enabled: true },
  { school:'University of Edinburgh', shortName:'Edinburgh', country:'UK', region:'英国', major:'CS', rank:'QS #27', minGpa:3.2, avgGpa:3.5, toefl:92, gre:'不需要', tier:'match', deadline:'2月1日', tuition:'£35,000/年', duration:'1年', highlight:'AI 方向欧洲领先', enabled: true },
  { school:"King's College London", shortName:'KCL', country:'UK', region:'英国', major:'CS', rank:'QS #40', minGpa:3.0, avgGpa:3.3, toefl:85, gre:'不需要', tier:'safety', deadline:'滚动录取', tuition:'£32,000/年', duration:'1年', highlight:'伦敦地区，实习资源好', enabled: true },
  { school:'Northwestern University', shortName:'Northwestern', country:'US', region:'美国', major:'MKT', rank:'US #6', minGpa:3.3, avgGpa:3.6, toefl:100, gre:'320+', tier:'reach', deadline:'1月10日', tuition:'$70,000/年', duration:'15个月', highlight:'IMC 项目全美第一', enabled: true },
  { school:'New York University', shortName:'NYU', country:'US', region:'美国', major:'MKT', rank:'US #25', minGpa:3.0, avgGpa:3.4, toefl:100, gre:'315+', tier:'match', deadline:'2月15日', tuition:'$72,000/年', duration:'1-2年', highlight:'纽约 4A 实习资源丰富', enabled: true },
  { school:'Boston University', shortName:'BU', country:'US', region:'美国', major:'MKT', rank:'US #43', minGpa:3.0, avgGpa:3.3, toefl:84, gre:'可选', tier:'match', deadline:'3月15日', tuition:'$60,000/年', duration:'1年', highlight:'MKT+BA 复合方向', enabled: true },
  { school:'香港大学', shortName:'HKU', country:'HK', region:'香港', major:'MKT', rank:'QS #17', minGpa:3.2, avgGpa:3.5, toefl:97, gre:'GMAT 650+', tier:'reach', deadline:'1月31日', tuition:'港币32万/年', duration:'1年', highlight:'商学院顶配，GMAT 必须', enabled: true },
  { school:'香港中文大学', shortName:'CUHK', country:'HK', region:'香港', major:'MKT', rank:'QS #36', minGpa:3.0, avgGpa:3.4, toefl:90, gre:'可选 GMAT', tier:'match', deadline:'2月28日', tuition:'港币32万/年', duration:'1年', highlight:'港中文商学院，中港 networking', enabled: true },
  { school:'香港城市大学', shortName:'CityU', country:'HK', region:'香港', major:'MKT', rank:'QS #62', minGpa:2.8, avgGpa:3.2, toefl:79, gre:'不需要', tier:'safety', deadline:'5月31日', tuition:'港币20万/年', duration:'1年', highlight:'录取友好，无需 GMAT', enabled: true },
  { school:'London School of Economics', shortName:'LSE', country:'UK', region:'英国', major:'MKT', rank:'QS #45', minGpa:3.5, avgGpa:3.7, toefl:107, gre:'GMAT 650+', tier:'reach', deadline:'1月15日', tuition:'£37,000/年', duration:'1年', highlight:'G5 商科，极看重本科背景', enabled: true },
  { school:'University of Manchester', shortName:'Manchester', country:'UK', region:'英国', major:'MKT', rank:'QS #34', minGpa:3.2, avgGpa:3.4, toefl:100, gre:'不需要', tier:'match', deadline:'滚动录取', tuition:'£32,000/年', duration:'1年', highlight:'分批审理，中国学生多', enabled: true },
  { school:'University of Warwick', shortName:'Warwick', country:'UK', region:'英国', major:'MKT', rank:'QS #67', minGpa:3.0, avgGpa:3.3, toefl:100, gre:'不需要', tier:'safety', deadline:'滚动录取', tuition:'£33,000/年', duration:'1年', highlight:'WBS 商学院，综合排名靠前', enabled: true },
]

const BENCHMARKS = [
  { tier: 'reach',  labels: ['院校背景','GPA','语言','标化','实习','科研','推荐信'], dimensions: [88, 82, 80, 80, 75, 85, 75] },
  { tier: 'match',  labels: ['院校背景','GPA','语言','标化','实习','科研','推荐信'], dimensions: [80, 75, 75, 75, 70, 80, 68] },
  { tier: 'safety', labels: ['院校背景','GPA','语言','标化','实习','科研','推荐信'], dimensions: [70, 65, 60, 55, 60, 60, 55] },
]

async function ensureCollection(name) {
  try {
    // 先尝试查一条，如果集合不存在会抛错
    await db.collection(name).limit(1).get()
  } catch (e) {
    // 集合不存在，尝试创建（通过插入一条空数据再删除）
    try {
      const res = await db.collection(name).add({ data: { _init_: true } })
      if (res._id) {
        await db.collection(name).doc(res._id).remove()
      }
    } catch (e2) {
      return { created: false, error: e2 }
    }
  }
  return { created: true }
}

async function clearCollection(name) {
  let deleted = 0
  try {
    let hasMore = true
    while (hasMore) {
      const res = await db.collection(name).limit(100).get()
      if (res.data.length === 0) {
        hasMore = false
        break
      }
      const tasks = res.data.map(item => db.collection(name).doc(item._id).remove())
      await Promise.all(tasks)
      deleted += res.data.length
    }
  } catch (e) {
    // 集合不存在等
    return 0
  }
  return deleted
}

exports.main = async (event, context) => {
  try {
    // 1. 确保集合存在
    const collections = ['programs', 'benchmarks']
    for (const name of collections) {
      const result = await ensureCollection(name)
      if (!result.created) {
        return { code: -1, message: `集合 ${name} 创建失败`, error: result.error }
      }
    }

    // 2. 清空旧数据
    const deletedPrograms = await clearCollection('programs')
    const deletedBenchmarks = await clearCollection('benchmarks')

    // 3. 批量导入 programs
    const programTasks = PROGRAMS.map(p => db.collection('programs').add({ data: p }))
    const programResults = await Promise.all(programTasks)

    // 4. 批量导入 benchmarks
    const benchTasks = BENCHMARKS.map(b => db.collection('benchmarks').add({ data: b }))
    const benchResults = await Promise.all(benchTasks)

    return {
      code: 0,
      message: '数据迁移完成',
      details: {
        programsImported: programResults.length,
        benchmarksImported: benchResults.length,
        programsCleared: deletedPrograms,
        benchmarksCleared: deletedBenchmarks
      }
    }
  } catch (err) {
    return { code: -1, message: '迁移失败', error: err.message, stack: err.stack }
  }
}
