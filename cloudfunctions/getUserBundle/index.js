// cloudfunctions/getUserBundle/index.js
const cloud = require('wx-server-sdk')
const { runMatch } = require('./match-logic.js')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 一次性返回用户所有核心数据，避免多次云函数冷启动
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const timestamp = Date.now()

  try {
    // ========== 并行查询所有数据 ==========
    const [userRes, programsRes] = await Promise.all([
      db.collection('users').where({ _openid: OPENID }).get().catch(() => ({ data: [] })),
      db.collection('programs').where({ enabled: true }).get().catch(() => ({ data: [] }))
    ])

    const user = (userRes.data && userRes.data[0]) || {}
    const programs = programsRes.data || []

    // ========== 匹配结果：优先用已有的，没有则计算 ==========
    let matchResult = user.matchResult
    const MATCH_TTL = 24 * 60 * 60 * 1000 // 24小时内有效

    if (!matchResult || !matchResult.reach || !matchResult.reach.length ||
        (matchResult.calculatedAt && timestamp - matchResult.calculatedAt > MATCH_TTL)) {
      const profile = user.profile || {}
      matchResult = runMatch(profile, programs)
      matchResult.calculatedAt = timestamp

      // 异步写回用户记录（不阻塞返回）
      db.collection('users').where({ _openid: OPENID }).update({
        data: { matchResult, updatedAt: timestamp }
      }).catch(() => {})
    }

    // ========== 构建基准数据（与原 getBenchmarks 一致的硬编码默认值） ==========
    const benchmarks = {
      reach: [88, 82, 80, 80, 75, 85, 75],
      match: [80, 75, 75, 75, 70, 80, 68],
      safety: [70, 65, 60, 55, 60, 60, 55]
    }

    // ========== 收藏列表（存在 users.favorites[] 里，是 programId 数组） ==========
    const favorites = user.favorites || []

    // ========== 组装返回 ==========
    return {
      success: true,
      profile: user.profile || {},
      wxProfile: user.wxProfile || {},
      matchResult,
      benchmarks,
      favorites,
      timestamp
    }
  } catch (err) {
    console.error('[getUserBundle] error', err)
    return {
      success: false,
      error: err.message,
      profile: {},
      wxProfile: {},
      matchResult: null,
      benchmarks: null,
      favorites: [],
      timestamp
    }
  }
}