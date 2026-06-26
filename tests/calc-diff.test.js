const assert = require('assert')
const path = require('path')
const logic = require(path.resolve(__dirname, '../cloudfunctions/matchPrograms/match-logic.js'))

const baseline = {
  reach: [{ _id: 'a1', school: 'CMU', fitScore: 40 }],
  match: [{ _id: 'b1', school: 'Columbia', fitScore: 65 }],
  safety: [{ _id: 'c1', school: 'USC', fitScore: 82 }]
}

const simResult = {
  reach: [],
  match: [{ _id: 'a1', school: 'CMU', fitScore: 72 }, { _id: 'b1', school: 'Columbia', fitScore: 65 }],
  safety: [{ _id: 'c1', school: 'USC', fitScore: 82 }]
}

const result = logic.calcDiff(baseline, simResult)

assert.strictEqual(result.diff.reach.baseline, 1)
assert.strictEqual(result.diff.reach.after, 0)
assert.strictEqual(result.diff.match.baseline, 1)
assert.strictEqual(result.diff.match.after, 2)
assert.strictEqual(result.diff.safety.baseline, 1)
assert.strictEqual(result.diff.safety.after, 1)

assert.strictEqual(result.upgradedPrograms.length, 1)
assert.strictEqual(result.upgradedPrograms[0].school, 'CMU')
assert.strictEqual(result.upgradedPrograms[0].from, 'reach')
assert.strictEqual(result.upgradedPrograms[0].to, 'match')

console.log('calcDiff test passed')
