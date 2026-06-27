/**
 * match-logic.js — shared matching algorithm for GradGuide
 *
 * Contains all scoring, filtering, and reason-generation logic.
 * Designed to be `require()`-ed by cloud-function entry points and
 * by the simulator page (via copy or symlink).
 */

// ──────────────────────────────────────────────
// Step 1: getSelectivityBand fallback
// ──────────────────────────────────────────────

function getSelectivityBand(program) {
  if (program.selectivityBand) return program.selectivityBand
  if (program.tier === 'reach' && /#\d{1,2}/.test(program.rank)) return 'elite'
  if (program.tier === 'reach') return 'high'
  if (program.tier === 'match' && /#\d{1,3}/.test(program.rank)) return 'mid'
  return 'friendly'
}

// ──────────────────────────────────────────────
// Step 2: BAND_MAP + qualifiesForExtremeReach
// ──────────────────────────────────────────────

const BAND_MAP = {
  '985 · C9 联盟': { visible: ['elite','high','mid','friendly'], extremeReach: [] },
  '985':            { visible: ['high','mid','friendly'],       extremeReach: ['elite'] },
  '211':            { visible: ['mid','friendly'],              extremeReach: ['elite','high'] },
  '双一流':          { visible: ['mid','friendly'],              extremeReach: ['high'] },
  '海外本科':        { visible: ['high','mid','friendly'],       extremeReach: ['elite'] },
  '中外合办':        { visible: ['mid','friendly'],              extremeReach: ['high'] },
  '双非一本':        { visible: ['mid','friendly'],              extremeReach: ['high'] },
  '双非二本':        { visible: ['friendly'],                   extremeReach: ['mid'] }
}

const TARGET_COUNTS = {
  reach: { min: 2, ideal: 3, max: 3 },
  match: { min: 8, ideal: 10, max: 10 },
  safety: { min: 3, ideal: 4, max: 5 }
}

function qualifiesForExtremeReach(profile) {
  const gpa = profile.gpa || 0
  const toefl = profile.toefl || 0
  const gre = profile.gre || 0
  const hasResearch = (profile.research || []).length > 0
  const hasIntern = (profile.internships || []).length > 0
  if (gpa >= 3.5) return true
  if (toefl >= 100) return true
  if (gre >= 320) return true
  if (hasResearch && hasIntern) return true
  return false
}

// ──────────────────────────────────────────────
// Step 3: filterBySchoolBand
// ──────────────────────────────────────────────

function filterBySchoolBand(programs, schoolLevel, profile) {
  const bands = BAND_MAP[schoolLevel] || { visible: ['friendly'], extremeReach: ['mid'] }

  let candidates = programs.filter(p => bands.visible.includes(getSelectivityBand(p)))
  let extremeCount = 0

  if (qualifiesForExtremeReach(profile)) {
    let extras = programs.filter(p =>
      bands.extremeReach.includes(getSelectivityBand(p)) &&
      !candidates.includes(p)
    )
    extras.sort((a, b) => {
      const order = { reach: 0, match: 1, safety: 2 }
      return (order[a.tier] || 1) - (order[b.tier] || 1)
    })
    extras = extras.slice(0, 2)
    extremeCount = extras.length
    return {
      candidates: [
        ...candidates.map(p => ({ ...p, isExtremeReach: false })),
        ...extras.map(p => ({ ...p, isExtremeReach: true }))
      ],
      extremeCount
    }
  }

  return { candidates: candidates.map(p => ({ ...p, isExtremeReach: false })), extremeCount: 0 }
}

// ──────────────────────────────────────────────
// Step 4: calcStandardizedScore
// ──────────────────────────────────────────────

function calcStandardizedScore(program, profile) {
  const userToefl = profile.toefl || 0
  const userGre = profile.gre || 0
  const reqToefl = program.toefl || 0
  const reqGreStr = program.gre || ''

  let score = 60

  if (userToefl < reqToefl) {
    const gap = reqToefl - userToefl
    score -= Math.max(0, Math.ceil(gap / 2))
  }

  const isGreRequired = !(reqGreStr === '不需要' || reqGreStr === '可选' || reqGreStr === '')
  if (isGreRequired) {
    const reqGre = parseInt(reqGreStr) || 0
    if (userGre < reqGre) {
      const gap = reqGre - userGre
      score -= Math.max(0, Math.ceil(gap / 5))
    }
  }

  return Math.max(0, score)
}

// ──────────────────────────────────────────────
// Step 5: calcSchoolScore
// ──────────────────────────────────────────────

const SCHOOL_LEVELS = ['985 · C9 联盟', '985', '211', '双一流', '海外本科', '中外合办', '双非一本', '双非二本']
const BAND_LEVELS = ['elite', 'high', 'mid', 'friendly']

const SCHOOL_BAND_MAP = {
  '985 · C9 联盟': 0,   // 默认 elite
  '985':            1,   // 默认 high
  '211':            2,   // 默认 mid
  '双一流':          2,   // 默认 mid
  '海外本科':        1,   // 默认 high
  '中外合办':        2,   // 默认 mid
  '双非一本':        2,   // 默认 mid
  '双非二本':        3    // 默认 friendly
}

function calcSchoolScore(schoolLevel, selectivityBand) {
  const defaultBand = SCHOOL_BAND_MAP[schoolLevel]
  if (defaultBand === undefined) return 0
  const bi = BAND_LEVELS.indexOf(selectivityBand)
  if (bi === -1) return 0

  const diff = bi - defaultBand

  if (diff <= -2) return 12
  if (diff === -1) return 8
  if (diff === 0) return 4
  if (diff === 1) return 0
  if (diff === 2) return -5
  return -10
}

// ──────────────────────────────────────────────
// Step 6: calcGpaScore
// ──────────────────────────────────────────────

function calcGpaScore(program, userGpa) {
  const avgGpa = program.avgGpa || 3.5
  const gap = userGpa - avgGpa

  if (gap >= 0.3) return 10
  if (gap >= 0.1) return 6
  if (gap >= -0.1) return 4
  if (gap >= -0.3) return 0
  return -5
}

// ──────────────────────────────────────────────
// Step 7: calcBackgroundScore
// ──────────────────────────────────────────────

function calcBackgroundScore(program, profile) {
  const major = program.major || ''
  const researchCount = (profile.research || []).length
  const internCount = (profile.internships || []).length

  if (major === 'CS' || major === 'DS') {
    return Math.min(8, Math.min(5, researchCount * 2.5) + Math.min(3, internCount * 1.5))
  }
  if (major === 'MKT' || major === 'BA') {
    return Math.min(8, Math.min(3, researchCount * 1.5) + Math.min(5, internCount * 2.5))
  }
  return Math.min(8, Math.min(4, researchCount * 2) + Math.min(4, internCount * 2))
}

// ──────────────────────────────────────────────
// Step 8: calcPreferenceScore
// ──────────────────────────────────────────────

function calcPreferenceScore(program, profile) {
  let score = 0
  const targetRegions = profile.targetRegions || []
  const targetMajors = profile.targetMajors || []

  if (targetRegions.includes(program.region)) score += 2
  if (targetMajors.some(m => program.major.includes(m) || m.includes(program.major))) score += 2
  if (profile.priority === program.highlight) score += 1

  return Math.min(5, score)
}

function preferenceScoreForSort(program, profile) {
  return calcPreferenceScore(program, profile)
}

function sortByPreferenceThenScore(pool, profile, options) {
  const preferFriendly = options && options.preferFriendly
  const bandWeight = { friendly: 0, mid: 1, high: 2, elite: 3 }

  return [...pool].sort((a, b) => {
    const prefDiff = preferenceScoreForSort(b, profile) - preferenceScoreForSort(a, profile)
    if (prefDiff !== 0) return prefDiff

    if (preferFriendly) {
      const aBand = getSelectivityBand(a)
      const bBand = getSelectivityBand(b)
      const bandDiff = (bandWeight[aBand] || 2) - (bandWeight[bBand] || 2)
      if (bandDiff !== 0) return bandDiff
    }

    return b.fitScore - a.fitScore
  })
}

function takeFromPool(pool, count, selectedIds) {
  const taken = []
  for (const item of pool) {
    const id = item._id || item.id || `${item.school}-${item.major}`
    if (selectedIds.has(id)) continue
    taken.push(item)
    selectedIds.add(id)
    if (taken.length >= count) break
  }
  return taken
}

function allocateBuckets(scored, profile) {
  const selectedIds = new Set()

  const reachPool = scored.filter(p => p.fitScore < 70)
  const matchPool = scored.filter(p => p.fitScore >= 70 && p.fitScore < 80)
  const safetyPool = scored.filter(p => p.fitScore >= 80)

  const reachSorted = sortByPreferenceThenScore(reachPool, profile)
  const matchSorted = sortByPreferenceThenScore(matchPool, profile)
  const safetySorted = sortByPreferenceThenScore(safetyPool, profile, { preferFriendly: true })

  const safety = takeFromPool(safetySorted, TARGET_COUNTS.safety.ideal, selectedIds)
  const match = takeFromPool(matchSorted, TARGET_COUNTS.match.ideal, selectedIds)
  const reach = takeFromPool(reachSorted, TARGET_COUNTS.reach.ideal, selectedIds)

  if (safety.length < TARGET_COUNTS.safety.min) {
    const matchHighFriendly = [...matchSorted]
      .filter(p => ['friendly', 'mid'].includes(getSelectivityBand(p)))
      .sort((a, b) => b.fitScore - a.fitScore)
    safety.push(...takeFromPool(matchHighFriendly, TARGET_COUNTS.safety.min - safety.length, selectedIds))
  }

  if (safety.length < TARGET_COUNTS.safety.min) {
    const matchHighNonElite = [...matchSorted]
      .filter(p => getSelectivityBand(p) !== 'elite')
      .sort((a, b) => b.fitScore - a.fitScore)
    safety.push(...takeFromPool(matchHighNonElite, TARGET_COUNTS.safety.min - safety.length, selectedIds))
  }

  if (safety.length < TARGET_COUNTS.safety.min) {
    const remainingNonElite = [...scored]
      .filter(p => getSelectivityBand(p) !== 'elite')
      .sort((a, b) => b.fitScore - a.fitScore)
    safety.push(...takeFromPool(remainingNonElite, TARGET_COUNTS.safety.min - safety.length, selectedIds))
  }

  if (match.length < TARGET_COUNTS.match.min) {
    const safetyLow = [...safetySorted].sort((a, b) => a.fitScore - b.fitScore)
    match.push(...takeFromPool(safetyLow, TARGET_COUNTS.match.min - match.length, selectedIds))
  }
  if (match.length < TARGET_COUNTS.match.min) {
    const reachHigh = [...reachSorted].sort((a, b) => b.fitScore - a.fitScore)
    match.push(...takeFromPool(reachHigh, TARGET_COUNTS.match.min - match.length, selectedIds))
  }

  if (reach.length < TARGET_COUNTS.reach.min) {
    const matchLow = [...matchSorted].sort((a, b) => a.fitScore - b.fitScore)
    reach.push(...takeFromPool(matchLow, TARGET_COUNTS.reach.min - reach.length, selectedIds))
  }

  return { reach, match, safety }
}

// ──────────────────────────────────────────────
// Step 9: generateReasons / generateRisks
// ──────────────────────────────────────────────

function generateReasons(program, profile, scores) {
  const reasons = []
  if (scores.standardized >= 55) reasons.push('语言成绩达标')
  if (scores.school >= 8) reasons.push('院校背景适合该项目层级')
  if (scores.gpa >= 6) reasons.push('GPA 高于项目平均')
  if (scores.background >= 4) reasons.push(`${(profile.research || []).length} 段科研经历`)
  if (scores.background >= 4 && (profile.internships || []).length > 0) reasons.push(`${(profile.internships || []).length} 段实习经历`)
  if (scores.preference >= 2) reasons.push('目标地区/专业匹配')
  return reasons
}

function generateRisks(program, profile, scores) {
  const risks = []
  if (scores.standardized < 55) {
    const toeflGap = (program.toefl || 0) - (profile.toefl || 0)
    if (toeflGap > 0) risks.push(`TOEFL 差 ${toeflGap} 分`)
    const greStr = program.gre || ''
    if (greStr !== '不需要' && greStr !== '可选') {
      const reqGre = parseInt(greStr) || 0
      const userGre = profile.gre || 0
      if (reqGre > userGre) risks.push(`GRE 差 ${reqGre - userGre} 分`)
    }
  }
  if (scores.gpa <= 0) risks.push('GPA 偏低')
  if (profile.isExtremeReach) risks.push('极限冲刺，院校背景稍弱')
  return risks
}

// ──────────────────────────────────────────────
// Step 10: calcFitScore
// ──────────────────────────────────────────────

function calcFitScore(program, profile) {
  const scores = {
    standardized: calcStandardizedScore(program, profile),
    school: calcSchoolScore(profile.schoolLevel, getSelectivityBand(program)),
    gpa: calcGpaScore(program, profile.gpa || 0),
    background: calcBackgroundScore(program, profile),
    preference: calcPreferenceScore(program, profile)
  }

  let total = scores.standardized + scores.school + scores.gpa + scores.background + scores.preference
  total = Math.max(0, Math.min(95, Math.round(total)))

  const reasons = generateReasons(program, profile, scores)
  const risks = generateRisks(program, profile, scores)

  return { fitScore: total, reasons, risks }
}

// ──────────────────────────────────────────────
// Step 11: runMatch — main orchestrator
// ──────────────────────────────────────────────

function runMatch(profile, programs) {
  const schoolLevel = profile.schoolLevel || ''
  const { candidates, extremeCount } = filterBySchoolBand(programs, schoolLevel, profile)

  const scored = candidates.map(p => {
    const result = calcFitScore(p, profile)
    return {
      ...p,
      fitScore: result.fitScore,
      reasons: result.reasons,
      risks: result.risks
    }
  })

  const allocated = allocateBuckets(scored, profile)

  return {
    reach: allocated.reach,
    match: allocated.match,
    safety: allocated.safety,
    extremeReachCount: extremeCount,
    version: 'v2'
  }
}

function calcDiff(baseline, simResult) {
  const toMap = arr => new Map(arr.map(p => [p._id, p]))

  const baselineReach = toMap(baseline.reach || [])
  const baselineMatch = toMap(baseline.match || [])
  const baselineSafety = toMap(baseline.safety || [])
  const simReach = toMap(simResult.reach || [])
  const simMatch = toMap(simResult.match || [])
  const simSafety = toMap(simResult.safety || [])

  const newReach = (simResult.reach || []).filter(p => !baselineReach.has(p._id))
  const newMatch = (simResult.match || []).filter(p => !baselineMatch.has(p._id))
  const newSafety = (simResult.safety || []).filter(p => !baselineSafety.has(p._id))

  const upgraded = []
  const downgraded = []

  ;(baseline.reach || []).forEach(p => { if (simMatch.has(p._id)) upgraded.push({ ...p, from: 'reach', to: 'match' }) })
  ;(baseline.reach || []).forEach(p => { if (simSafety.has(p._id)) upgraded.push({ ...p, from: 'reach', to: 'safety' }) })
  ;(baseline.match || []).forEach(p => { if (simSafety.has(p._id)) upgraded.push({ ...p, from: 'match', to: 'safety' }) })
  ;(baseline.safety || []).forEach(p => { if (simMatch.has(p._id)) downgraded.push({ ...p, from: 'safety', to: 'match' }) })
  ;(baseline.match || []).forEach(p => { if (simReach.has(p._id)) downgraded.push({ ...p, from: 'match', to: 'reach' }) })
  ;(baseline.safety || []).forEach(p => { if (simReach.has(p._id)) downgraded.push({ ...p, from: 'safety', to: 'reach' }) })

  const diff = {
    reach: {
      baseline: (baseline.reach || []).length,
      after: (simResult.reach || []).length,
      delta: (simResult.reach || []).length - (baseline.reach || []).length
    },
    match: {
      baseline: (baseline.match || []).length,
      after: (simResult.match || []).length,
      delta: (simResult.match || []).length - (baseline.match || []).length
    },
    safety: {
      baseline: (baseline.safety || []).length,
      after: (simResult.safety || []).length,
      delta: (simResult.safety || []).length - (baseline.safety || []).length
    },
    totalDelta: (simResult.reach || []).length + (simResult.match || []).length + (simResult.safety || []).length -
      (baseline.reach || []).length - (baseline.match || []).length - (baseline.safety || []).length
  }

  return { diff, newPrograms: { reach: newReach, match: newMatch, safety: newSafety }, upgradedPrograms: upgraded, downgradedPrograms: downgraded }
}

// ──────────────────────────────────────────────
// Step 12: exports
// ──────────────────────────────────────────────

module.exports = { runMatch, calcFitScore, getSelectivityBand, BAND_MAP, TARGET_COUNTS, allocateBuckets, calcDiff, qualifiesForExtremeReach, filterBySchoolBand }