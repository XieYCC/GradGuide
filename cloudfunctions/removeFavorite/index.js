// 云函数：removeFavorite - 取消收藏
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { programId } = event

  if (!programId) {
    return { code: -1, message: 'programId 不能为空' }
  }

  await db.collection('users').where({
    _openid: OPENID
  }).update({
    data: {
      favorites: db.command.pull(programId),
      updatedAt: db.serverDate()
    }
  })

  return { code: 0, message: '已取消收藏' }
}
