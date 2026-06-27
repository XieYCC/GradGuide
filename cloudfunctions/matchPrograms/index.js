// cloudfunctions/matchPrograms/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { runMatch, getSelectivityBand } = require('./match-logic')

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { reach: [], match: [], safety: [], extremeReachCount: 0 }
  }

  const userRes = await db.collection('users').where({ _openid: OPENID }).get()
  if (!userRes.data.length) {
    return { reach: [], match: [], safety: [], extremeReachCount: 0 }
  }

  const profile = userRes.data[0].profile || {}

  // Get all enabled programs
  const programsRes = await db.collection('programs').where({ enabled: true }).limit(1000).get()
  const programs = programsRes.data

  if (!programs.length) {
    return { reach: [], match: [], safety: [], extremeReachCount: 0 }
  }

  // Ensure each program has a selectivityBand via fallback
  programs.forEach(p => {
    if (!p.selectivityBand) {
      p.selectivityBand = getSelectivityBand(p)
    }
  })

  const result = runMatch(programs, profile)
  return result
}
