# School Matching Allocation v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current simple sorted slice allocation with v2 bucket allocation: score first, bucket by score, then fill reach/match/safety target ranges without putting low-score elite programs into safety.

**Architecture:** `cloudfunctions/matchPrograms/match-logic.js` remains the source of truth. The same file is copied into `cloudfunctions/saveProfile/match-logic.js` because each WeChat cloud function has an isolated package. Tests use Node scripts against the shared match logic.

**Tech Stack:** WeChat Mini Program cloud functions, Node.js 16, wx-server-sdk, no project-level npm/build step.

## Global Constraints

- WXML cannot use advanced JS expressions; this plan only changes cloud-function JS.
- `matchPrograms/match-logic.js` and `saveProfile/match-logic.js` must stay identical after the change.
- No change to scoring weights in this plan; only allocation of already-scored projects changes.
- Default target counts: reach 3, match 10, safety 4.
- Allowed final ranges: reach 2-3, match 8-10, safety 3-5.
- Do not put `elite` programs into `safety` during backfill.

---

## File Structure

**Modified:**
- `cloudfunctions/matchPrograms/match-logic.js` — add `TARGET_COUNTS`, `sortByPreferenceThenScore`, `allocateBuckets`, and update `runMatch`.
- `cloudfunctions/saveProfile/match-logic.js` — exact copy of `matchPrograms/match-logic.js` after edits.

**Tested:**
- `node -c cloudfunctions/matchPrograms/match-logic.js`
- `node -c cloudfunctions/saveProfile/match-logic.js`
- one-off Node script that verifies CMU/Cambridge/elite low-score projects are not in safety for the current sample profile.

---

### Task 1: Add Allocation v2 Helpers

**Files:**
- Modify: `cloudfunctions/matchPrograms/match-logic.js`
- Modify: `cloudfunctions/saveProfile/match-logic.js` (copy after edits)

**Interfaces:**
- Consumes: scored program objects from `runMatch`, each containing `fitScore`, `selectivityBand`, `region`, `major`.
- Produces: `allocateBuckets(scored, profile) -> { reach, match, safety }`.

- [ ] **Step 1: Write failing test script**

Create `tests/match-allocation-v2.test.js` with this content:

```js
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
```

- [ ] **Step 2: Run test to verify it fails with current simple slice allocation**

Run:

```bash
node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/match-allocation-v2.test.js
```

Expected before implementation: FAIL because the current simple slice allocation can put low-score elite programs into safety or produce invalid semantic allocation.

- [ ] **Step 3: Add TARGET_COUNTS after BAND_MAP in `cloudfunctions/matchPrograms/match-logic.js`**

Insert after the `BAND_MAP` constant:

```js
const TARGET_COUNTS = {
  reach: { min: 2, ideal: 3, max: 3 },
  match: { min: 8, ideal: 10, max: 10 },
  safety: { min: 3, ideal: 4, max: 5 }
}
```

- [ ] **Step 4: Add helper `preferenceScoreForSort` after `calcPreferenceScore`**

```js
function preferenceScoreForSort(program, profile) {
  return calcPreferenceScore(program, profile)
}
```

- [ ] **Step 5: Add helper `sortByPreferenceThenScore` after `preferenceScoreForSort`**

```js
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
```

- [ ] **Step 6: Add helper `takeFromPool` after `sortByPreferenceThenScore`**

```js
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
```

- [ ] **Step 7: Add `allocateBuckets(scored, profile)` after `takeFromPool`**

```js
function allocateBuckets(scored, profile) {
  const selectedIds = new Set()

  const reachPool = scored.filter(p => p.fitScore < 70)
  const matchPool = scored.filter(p => p.fitScore >= 70 && p.fitScore < 80)
  const safetyPool = scored.filter(p => p.fitScore >= 80)

  const reachSorted = sortByPreferenceThenScore(reachPool, profile)
  const matchSorted = sortByPreferenceThenScore(matchPool, profile)
  const safetySorted = sortByPreferenceThenScore(safetyPool, profile, { preferFriendly: true })

  const reach = takeFromPool(reachSorted, TARGET_COUNTS.reach.ideal, selectedIds)
  const match = takeFromPool(matchSorted, TARGET_COUNTS.match.ideal, selectedIds)
  const safety = takeFromPool(safetySorted, TARGET_COUNTS.safety.ideal, selectedIds)

  // Fill reach from lower-scoring match candidates when reach is below min.
  if (reach.length < TARGET_COUNTS.reach.min) {
    const matchLow = [...matchSorted].sort((a, b) => a.fitScore - b.fitScore)
    reach.push(...takeFromPool(matchLow, TARGET_COUNTS.reach.min - reach.length, selectedIds))
  }

  // Fill match from high-scoring reach candidates and low-scoring safety candidates.
  if (match.length < TARGET_COUNTS.match.min) {
    const reachHigh = [...reachSorted].sort((a, b) => b.fitScore - a.fitScore)
    match.push(...takeFromPool(reachHigh, TARGET_COUNTS.match.min - match.length, selectedIds))
  }
  if (match.length < TARGET_COUNTS.match.min) {
    const safetyLow = [...safetySorted].sort((a, b) => a.fitScore - b.fitScore)
    match.push(...takeFromPool(safetyLow, TARGET_COUNTS.match.min - match.length, selectedIds))
  }

  // Fill safety from high-scoring match candidates, friendly/mid first.
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

  return { reach, match, safety }
}
```

- [ ] **Step 8: Replace simple slice allocation in `runMatch`**

Replace the current block:

```js
const sorted = scored.sort((a, b) => b.fitScore - a.fitScore)

return {
  reach: sorted.slice(0, 2),
  match: sorted.slice(2, 12),
  safety: sorted.slice(12, 17),
  extremeReachCount: extremeCount,
  version: 'v1',
  calculatedAt: new Date()
}
```

with:

```js
const allocated = allocateBuckets(scored, profile)

return {
  reach: allocated.reach,
  match: allocated.match,
  safety: allocated.safety,
  extremeReachCount: extremeCount,
  version: 'v2',
  calculatedAt: new Date()
}
```

- [ ] **Step 9: Export `allocateBuckets` and `TARGET_COUNTS`**

Update the final `module.exports` to:

```js
module.exports = { runMatch, calcFitScore, getSelectivityBand, BAND_MAP, TARGET_COUNTS, allocateBuckets, qualifiesForExtremeReach, filterBySchoolBand }
```

- [ ] **Step 10: Sync match logic to saveProfile**

Run:

```bash
cp /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/matchPrograms/match-logic.js /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/saveProfile/match-logic.js
```

- [ ] **Step 11: Verify syntax**

Run:

```bash
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/matchPrograms/match-logic.js
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/saveProfile/match-logic.js
```

Expected: no output / exit 0.

- [ ] **Step 12: Run allocation v2 test to verify it passes**

Run:

```bash
node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/match-allocation-v2.test.js
```

Expected:

```text
allocation v2 counts: { reach: ..., match: ..., safety: ... }
safety: [ ... ]
```

No assertion failures.

- [ ] **Step 13: Commit**

```bash
git add cloudfunctions/matchPrograms/match-logic.js cloudfunctions/saveProfile/match-logic.js tests/match-allocation-v2.test.js
git commit -m "feat: allocate match results by target bucket ranges"
```
