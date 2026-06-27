// 云函数：getSimHistory - 获取模拟历史列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const res = await db.collection('users').where({
    _openid: OPENID
  }).field({
    simHistory: true
  }).get()

  if (res.data.length === 0) {
    return { list: [] }
  }

  // 按时间倒序排列（最新在前）
  const history = (res.data[0].simHistory || []).reverse()

  return { list: history }
}
