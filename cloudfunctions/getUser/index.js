// 云函数：getUser - 读取当前用户完整数据
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const res = await db.collection('users').where({
    _openid: OPENID
  }).get()

  if (res.data.length === 0) {
    return { profile: {}, favorites: [], simHistory: [], wxProfile: {} }
  }

  const user = res.data[0]
  return {
    profile: user.profile || {},
    favorites: user.favorites || [],
    simHistory: user.simHistory || [],
    wxProfile: user.wxProfile || {},
    matchResult: user.matchResult || null
  }
}
