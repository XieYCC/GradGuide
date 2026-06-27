// 云函数：deleteSimResult - 删除某条模拟记录
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { timestamp } = event

  if (!timestamp) {
    return { code: -1, message: 'timestamp 不能为空' }
  }

  // 按 timestamp 删除（精确匹配）
  await db.collection('users').where({
    _openid: OPENID
  }).update({
    data: {
      simHistory: db.command.pull({ timestamp: timestamp }),
      updatedAt: db.serverDate()
    }
  })

  return { code: 0, message: '删除成功' }
}
