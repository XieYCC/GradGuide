const assert = require('assert')
const path = require('path')

const logic = require(path.resolve(__dirname, '../cloudfunctions/matchPrograms/match-logic.js'))
const { PROGRAMS } = require(path.resolve(__dirname, '../utils/data.js'))

const profile = {
  schoolLevel: '985',
  gpa: 3.2,
  toefl: 88,
  gre: 302,
  targetRegions: ['香港', '混申'],
  targetMajors: [],
  research: [{ name: '图像生成', type: '校内导师项目' }],
  internships: [{ name: '腾讯音乐', type: '' }],
  priority: ''
}

const result = logic.runMatch(PROGRAMS, profile)

assert(result.reach.length >= 2 && result.reach.length <= 3, `reach count should be 2-3, got ${result.reach.length}`)
assert(result.match.length >= 8 && result.match.length <= 10, `match count should be 8-10, got ${result.match.length}`)
assert(result.safety.length >= 3 && result.safety.length <= 5, `safety count should be 3-5, got ${result.safety.length}`)

const safetyNames = result.safety.map(p => `${p.school} ${p.major}`)
assert(!safetyNames.some(n => n.includes('Carnegie Mellon')), 'CMU must not appear in safety')
assert(!safetyNames.some(n => n.includes('Cambridge')), 'Cambridge must not appear in safety')
assert(!result.safety.some(p => p.selectivityBand === 'elite'), 'elite programs must not appear in safety')

console.log('allocation v2 counts:', {
  reach: result.reach.length,
  match: result.match.length,
  safety: result.safety.length
})
console.log('safety:', safetyNames)
