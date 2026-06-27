// 云函数：getPrograms - 获取项目列表，支持筛选
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { region, major } = event
  // region: 'all' | 'US' | 'HK' | 'UK'
  // major: 'all' | 'CS' | 'MKT'

  let query = { enabled: true }

  if (region && region !== 'all') {
    query.country = region
  }
  if (major && major !== 'all') {
    query.major = major
  }

  const res = await db.collection('programs')
    .where(query)
    .orderBy('school', 'asc')
    .get()

  return { list: res.data, total: res.data.length }
}
