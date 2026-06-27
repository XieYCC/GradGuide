// 云函数：getBenchmarks - 获取各档位基准数据
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const res = await db.collection('benchmarks').get()

  const benchMap = {}
  res.data.forEach(item => {
    benchMap[item.tier] = item.dimensions
  })

  return {
    benchmarks: benchMap,
    list: res.data
  }
}
