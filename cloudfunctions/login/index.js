// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 登录：获取 openid，首次登录自动创建用户记录
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const existing = await db.collection('users').where({
    _openid: OPENID
  }).get()

  if (existing.data.length === 0) {
    // 首次登录，创建空档案
    await db.collection('users').add({
      data: {
        _openid: OPENID,
        profile: {},
        favorites: [],
        simHistory: [],
        wxProfile: {},
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })
    return { isNewUser: true, openid: OPENID }
  }

  return { isNewUser: false, openid: OPENID }
}
