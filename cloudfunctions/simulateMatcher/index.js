const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { runMatch, getSelectivityBand, calcDiff, allocateBuckets, calcFitScore, filterBySchoolBand } = require('./match-logic')

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { simResult: { reach: [], match: [], safety: [] }, diff: {}, newPrograms: {}, upgradedPrograms: [], downgradedPrograms: [] }
  }

  const userRes = await db.collection('users').where({ _openid: OPENID }).get()
  if (!userRes.data.length) {
    return { simResult: { reach: [], match: [], safety: [] }, diff: {}, newPrograms: {}, upgradedPrograms: [], downgradedPrograms: [] }
  }

  const realProfile = userRes.data[0].profile || {}
  const baseline = userRes.data[0].matchResult || { reach: [], match: [], safety: [] }

  // Merge sim overrides
  const simProfile = { ...realProfile }
  if (event.gpa !== undefined) simProfile.gpa = event.gpa
  if (event.toefl !== undefined) simProfile.toefl = event.toefl
  if (event.gre !== undefined) simProfile.gre = event.gre

  // paper, research, intern, award are boolean toggles that affect background score
  const researchList = [...(realProfile.research || [])]
  const internList = [...(realProfile.internships || [])]
  if (event.research) researchList.push({ name: '模拟新增科研', type: '模拟' })
  if (event.intern) internList.push({ name: '模拟新增实习', type: '模拟' })
  simProfile.research = researchList
  simProfile.internships = internList
  if (event.paper) simProfile.paper = true
  if (event.award) simProfile.award = true

  // Get programs
  const progRes = await db.collection('programs').where({ enabled: true }).get()
  const programs = progRes.data || []
  programs.forEach(p => { if (!p.selectivityBand) p.selectivityBand = getSelectivityBand(p) })

  // Run match
  const { candidates } = filterBySchoolBand(programs, simProfile.schoolLevel || '', simProfile)
  const scores = candidates.map(p => {
    const result = calcFitScore(p, simProfile)
    return { ...p, ...result }
  })
  const simResult = allocateBuckets(scores, simProfile)
  const diffResult = calcDiff(baseline, simResult)

  return {
    simResult,
    ...diffResult
  }
}
