// 云函数：searchPrograms - 按关键词搜索项目
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { keyword } = event

  if (!keyword || keyword.trim() === '') {
    return { list: [] }
  }

  const kw = keyword.trim()

  // 用正则模糊匹配学校名或专业名
  const res = await db.collection('programs').where({
    enabled: true,
    $or: [
      { school: db.RegExp({ regexp: kw, options: 'i' }) },
      { shortName: db.RegExp({ regexp: kw, options: 'i' }) },
      { major: db.RegExp({ regexp: kw, options: 'i' }) }
    ]
  }).get()

  return { list: res.data, total: res.data.length }
}
