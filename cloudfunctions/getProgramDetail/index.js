// 云函数：getProgramDetail - 获取单个项目详情
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { programId } = event

  if (!programId) {
    return { code: -1, message: 'programId 不能为空' }
  }

  const res = await db.collection('programs').doc(programId).get()

  if (!res.data) {
    return { code: -1, message: '项目不存在' }
  }

  return { code: 0, data: res.data }
}
