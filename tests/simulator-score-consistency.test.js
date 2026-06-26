const assert = require('assert')
const { calcScore } = require('../utils/util')

const base = { gpa: 3.2, toefl: 88, gre: 302, paper: false, research: true, intern: true, award: false }
const baseScore = calcScore(base)
assert.strictEqual(baseScore, 53, 'sample profile should score 53 and match diagnosis baseline')

assert(calcScore({ ...base, paper: true }) > baseScore, 'paper boost should increase score')
assert(calcScore({ ...base, research: false }) < baseScore, 'removing research should lower score')
assert(calcScore({ ...base, intern: false }) < baseScore, 'removing internship should lower score')
assert(calcScore({ ...base, award: true }) > baseScore, 'award boost should increase score')

console.log('simulator score consistency test passed')
