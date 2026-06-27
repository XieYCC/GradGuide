// 云函数：addFavorite - 收藏一个项目
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { programId } = event

  if (!programId) {
    return { code: -1, message: 'programId 不能为空' }
  }

  const res = await db.collection('users').where({
    _openid: OPENID
  }).update({
    data: {
      favorites: db.command.addToSet(programId),
      updatedAt: db.serverDate()
    }
  })

  return { code: 0, message: '收藏成功' }
}
