// 云函数：getFavorites - 获取用户收藏列表（含项目详情）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  // 1. 获取用户收藏的 programId 列表
  const userRes = await db.collection('users').where({
    _openid: OPENID
  }).field({
    favorites: true
  }).get()

  if (userRes.data.length === 0) {
    return { list: [] }
  }

  const favoriteIds = userRes.data[0].favorites || []
  if (favoriteIds.length === 0) {
    return { list: [] }
  }

  // 2. 联表查询项目详情
  const programRes = await db.collection('programs').where({
    _id: db.command.in(favoriteIds)
  }).get()

  return { list: programRes.data }
}
