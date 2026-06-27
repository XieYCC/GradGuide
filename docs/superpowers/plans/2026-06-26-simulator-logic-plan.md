# Simulator Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the simulator from hardcoded `calcScore`/`calcTier` to calling a cloud function `simulateMatcher` that shares the match logic with the match page, returning a full comparison diff.

**Architecture:** New cloud function `simulateMatcher` uses the existing `match-logic.js` (same algorithm as matchPrograms). A new `calcDiff` helper in `match-logic.js` compares two match results. The simulator page reads `users.matchResult` as baseline, adjusts sliders, clicks simulate button, shows diff results.

**Tech Stack:** WeChat Mini Program cloud functions, Node.js 16, wx-server-sdk, no project-level npm/build step.

## Global Constraints

- `cloudfunctions/simulateMatcher/` is a new cloud function — it must require `./match-logic.js` (the shared match algorithm).
- `cloudfunctions/simulateMatcher/match-logic.js` must be kept identical to `cloudfunctions/matchPrograms/match-logic.js`.
- The `calcDiff` function is added to `match-logic.js` and must be exported.
- WXML cannot use `=>`, `?.`, `&&` in expressions.
- The simulator page already has slider/checkbox controls — they remain as-is. Only the result display and the simulate method change.
- `paper`, `research`, `intern`, `award` are boolean booleans in the sim override but NOT part of `profile` in the real DB — they are sim-only concepts (booleans that don't need to persist).

---

## File Structure

**New:**
- `cloudfunctions/simulateMatcher/index.js` — cloud function entry point
- `cloudfunctions/simulateMatcher/package.json` — wx-server-sdk dependency
- `cloudfunctions/simulateMatcher/match-logic.js` — copy of matchPrograms/match-logic.js

**Modified:**
- `cloudfunctions/matchPrograms/match-logic.js` — add `calcDiff()` function and export it
- `cloudfunctions/saveProfile/match-logic.js` — sync (copy) after adding calcDiff
- `pages/simulator/simulator.js` — add `loadBaseline()`, `onSimulate()`, `onReset()`
- `pages/simulator/simulator.wxml` — add simulate result diff display
- `pages/simulator/simulator.wxss` — add styles for diff display

---

### Task 1: Add calcDiff to match-logic.js

**Files:**
- Modify: `cloudfunctions/matchPrograms/match-logic.js`

**Interfaces:**
- Consumes: `baseline` (matchResult object: `{reach, match, safety}`), `simResult` (same structure). Each project array contains objects with `_id`, `school`, `fitScore`, etc.
- Produces: `{ diff, newPrograms, upgradedPrograms, downgradedPrograms }` as described in the spec.

- [ ] **Step 1: Write the failing test**

Create `tests/calc-diff.test.js`:

```js
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
  match: [{ _id: 'a1', school: 'CMU', fitScore: 72 }],
  safety: [{ _id: 'b1', school: 'Columbia', fitScore: 88 }, { _id: 'c1', school: 'USC', fitScore: 82 }]
}

const result = logic.calcDiff(baseline, simResult)

assert.strictEqual(result.diff.reach.baseline, 1)
assert.strictEqual(result.diff.reach.after, 0)
assert.strictEqual(result.diff.match.baseline, 1)
assert.strictEqual(result.diff.match.after, 1)
assert.strictEqual(result.diff.safety.baseline, 1)
assert.strictEqual(result.diff.safety.after, 2)

assert.strictEqual(result.upgradedPrograms.length, 1)
assert.strictEqual(result.upgradedPrograms[0].school, 'CMU')
assert.strictEqual(result.upgradedPrograms[0].from, 'reach')
assert.strictEqual(result.upgradedPrograms[0].to, 'match')

assert.strictEqual(result.upgradedPrograms.length, 1)

console.log('calcDiff test passed')
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/calc-diff.test.js
```

Expected: FAIL with `logic.calcDiff is not a function` or similar.

- [ ] **Step 3: Add calcDiff function after allocateBuckets in match-logic.js**

```js
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

  // reach → match
  ;(baseline.reach || []).forEach(p => { if (simMatch.has(p._id)) upgraded.push({ ...p, from: 'reach', to: 'match' }) })
  // reach → safety
  ;(baseline.reach || []).forEach(p => { if (simSafety.has(p._id)) upgraded.push({ ...p, from: 'reach', to: 'safety' }) })
  // match → safety
  ;(baseline.match || []).forEach(p => { if (simSafety.has(p._id)) upgraded.push({ ...p, from: 'match', to: 'safety' }) })
  // safety → match
  ;(baseline.safety || []).forEach(p => { if (simMatch.has(p._id)) downgraded.push({ ...p, from: 'safety', to: 'match' }) })
  // match → reach
  ;(baseline.match || []).forEach(p => { if (simReach.has(p._id)) downgraded.push({ ...p, from: 'match', to: 'reach' }) })
  // safety → reach
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
```

- [ ] **Step 4: Update module.exports**

```js
module.exports = { runMatch, calcFitScore, getSelectivityBand, BAND_MAP, TARGET_COUNTS, allocateBuckets, calcDiff, qualifiesForExtremeReach, filterBySchoolBand }
```

- [ ] **Step 5: Sync to saveProfile**

```bash
cp /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/matchPrograms/match-logic.js /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/saveProfile/match-logic.js
```

- [ ] **Step 6: Verify syntax**

```bash
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/matchPrograms/match-logic.js
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/saveProfile/match-logic.js
```

- [ ] **Step 7: Run test to verify it passes**

```bash
node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/calc-diff.test.js
```

Expected: `calcDiff test passed`

- [ ] **Step 8: Commit**

```bash
git add cloudfunctions/matchPrograms/match-logic.js cloudfunctions/saveProfile/match-logic.js tests/calc-diff.test.js
git commit -m "feat: add calcDiff function for simulator comparison"
```

---

### Task 2: Create simulateMatcher cloud function

**Files:**
- Create: `cloudfunctions/simulateMatcher/index.js`
- Create: `cloudfunctions/simulateMatcher/package.json`
- Create: `cloudfunctions/simulateMatcher/match-logic.js` (copy)

**Interfaces:**
- Consumes: `{ gpa?, toefl?, gre?, paper?, research?, intern?, award? }` — optional profile overrides
- Produces: `{ simResult: { reach, match, safety }, diff, newPrograms, upgradedPrograms, downgradedPrograms }`

- [ ] **Step 1: Create match-logic.js (copy)**

```bash
mkdir -p /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/simulateMatcher
cp /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/matchPrograms/match-logic.js /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/simulateMatcher/match-logic.js
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "simulateMatcher",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.4"
  }
}
```

- [ ] **Step 3: Create index.js**

```js
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
```

- [ ] **Step 4: Verify syntax**

```bash
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/simulateMatcher/index.js
```

- [ ] **Step 5: Commit

```bash
git add cloudfunctions/simulateMatcher/
git commit -m "feat: create simulateMatcher cloud function"
```

---

### Task 3: Update simulator page

**Files:**
- Modify: `pages/simulator/simulator.js`
- Modify: `pages/simulator/simulator.wxml`
- Modify: `pages/simulator/simulator.wxss`

- [ ] **Step 1: Test the existing page loads without error**

- [ ] **Step 2: Modify simulator.js**

Replace the current `data` block to add new fields:

```js
data: {
  baseline: null,
  simResult: null,
  diff: null,
  newPrograms: { reach: [], match: [], safety: [] },
  upgradedPrograms: [],
  downgradedPrograms: [],
  showResult: false,
  simulating: false,
  // keep existing fields
  state: { gpa: '', toefl: '', gre: '', paper: false, research: false, intern: false, award: false },
  baseScore: 73,
  baseTier: { reach: 5, match: 10, safe: 6 },
  score: 73,
  tier: { reach: 0, match: 0, safe: 0 },
  scoreDelta: 0,
  unlockedList: [],
  todoItems: { thisWeek: [], thisMonth: [], thisQuarter: [] },
  history: [],
  showHistory: false,
  loadingTodos: true,
  loadingHistory: false,
  saving: false
}
```

Modify `onLoad`:

```js
onLoad() {
  this.loadBaseline()
  this.loadTodos()
  this.loadHistory()
}
```

Add `loadBaseline`:

```js
async loadBaseline() {
  try {
    const res = await wx.cloud.callFunction({ name: 'getUser' })
    const match = res.result?.matchResult
    if (match && (match.reach || match.match || match.safety)) {
      this.setData({ baseline: match })
    }
  } catch (err) {
    console.error('[simulator] load baseline failed', err)
  }
  // Load user real profile as initial state
  const profile = app.globalData.userProfile || {}
  this.setData({
    state: {
      gpa: profile.gpa || '',
      toefl: profile.toefl || '',
      gre: profile.gre || '',
      paper: false,
      research: false,
      intern: false,
      award: false
    }
  })
}
```

Add `onSimulate`:

```js
async onSimulate() {
  this.setData({ simulating: true, showResult: false })
  try {
    const res = await wx.cloud.callFunction({
      name: 'simulateMatcher',
      data: {
        gpa: parseFloat(this.data.state.gpa) || 0,
        toefl: parseFloat(this.data.state.toefl) || 0,
        gre: parseFloat(this.data.state.gre) || 0,
        paper: this.data.state.paper,
        research: this.data.state.research,
        intern: this.data.state.intern,
        award: this.data.state.award
      }
    })
    this.setData({
      simResult: res.result.simResult,
      diff: res.result.diff,
      newPrograms: res.result.newPrograms,
      upgradedPrograms: res.result.upgradedPrograms || [],
      downgradedPrograms: res.result.downgradedPrograms || [],
      showResult: true,
      simulating: false
    })
  } catch (err) {
    console.error('[simulate] failed', err)
    wx.showToast({ title: '模拟失败，请重试', icon: 'none' })
    this.setData({ simulating: false })
  }
}
```

Add `onReset`:

```js
onReset() {
  this.loadBaseline()
  this.setData({ showResult: false, simResult: null, diff: null, newPrograms: { reach: [], match: [], safety: [] }, upgradedPrograms: [], downgradedPrograms: [] })
}
```

Keep all existing methods: `onShow`, `loadTodos`, `loadHistory`, `onSaveResult`, `onDeleteHistory`, `onLoadHistory`, `toggleHistory`, `onSliderChange`, `onBoostChange`, `onTodoCheck`, `update`.

- [ ] **Step 3: Update simulator.wxml**

Keep the existing slider/checkbox controls unchanged.

Replace the existing school pool card with a new version that shows baseline results when not simulating, and diff results after simulation:

```xml
<!-- 学校池 (baseline) -->
<view class="card sim-pool-card" wx:if="{{!showResult && baseline}}">
  <text class="h-md sim-pool-title">当前选校结果</text>
  <view class="sim-pool-grid">
    <view class="sim-pool-item sim-pool-reach">
      <text class="sim-pool-label">冲刺</text>
      <text class="sim-pool-num">{{baseline.reach.length}}</text>
      <text class="sim-pool-unit">个 Program</text>
    </view>
    <view class="sim-pool-item sim-pool-match">
      <text class="sim-pool-label">匹配</text>
      <text class="sim-pool-num">{{baseline.match.length}}</text>
      <text class="sim-pool-unit">个 Program</text>
    </view>
    <view class="sim-pool-item sim-pool-safe">
      <text class="sim-pool-label">保底</text>
      <text class="sim-pool-num">{{baseline.safety.length}}</text>
      <text class="sim-pool-unit">个 Program</text>
    </view>
  </view>
</view>

<!-- 模拟结果（diff） -->
<view class="card sim-pool-card" wx:if="{{showResult && diff}}">
  <text class="h-md sim-pool-title">模拟后选校变化</text>
  <view class="sim-pool-grid">
    <view class="sim-pool-item sim-pool-reach">
      <text class="sim-pool-label">冲刺</text>
      <text class="sim-pool-num">{{diff.reach.after}}</text>
      <text class="sim-pool-delta {{diff.reach.delta > 0 ? 'up' : diff.reach.delta < 0 ? 'down' : ''}}">
        {{diff.reach.delta > 0 ? '+' : ''}}{{diff.reach.delta}}
      </text>
    </view>
    <view class="sim-pool-item sim-pool-match">
      <text class="sim-pool-label">匹配</text>
      <text class="sim-pool-num">{{diff.match.after}}</text>
      <text class="sim-pool-delta {{diff.match.delta > 0 ? 'up' : diff.match.delta < 0 ? 'down' : ''}}">
        {{diff.match.delta > 0 ? '+' : ''}}{{diff.match.delta}}
      </text>
    </view>
    <view class="sim-pool-item sim-pool-safe">
      <text class="sim-pool-label">保底</text>
      <text class="sim-pool-num">{{diff.safety.after}}</text>
      <text class="sim-pool-delta {{diff.safety.delta > 0 ? 'up' : diff.safety.delta < 0 ? 'down' : ''}}">
        {{diff.safety.delta > 0 ? '+' : ''}}{{diff.safety.delta}}
      </text>
    </view>
  </view>
  <text class="sim-diff-total">总新增: {{diff.totalDelta > 0 ? '+' + diff.totalDelta : diff.totalDelta}} 个项目</text>
</view>

<!-- 新增项目详情 -->
<view class="card" wx:if="{{showResult && (newPrograms.reach.length > 0 || newPrograms.match.length > 0 || newPrograms.safety.length > 0 || upgradedPrograms.length > 0)}}">
  <text class="h-md">变化详情</text>
  <view wx:if="{{newPrograms.reach.length > 0}}">
    <text class="sim-diff-section-title">新增冲刺:</text>
    <text class="sim-diff-item" wx:for="{{newPrograms.reach}}" wx:key="_id">{{item.school}}（{{item.fitScore}}分）</text>
  </view>
  <view wx:if="{{newPrograms.match.length > 0}}">
    <text class="sim-diff-section-title">新增匹配:</text>
    <text class="sim-diff-item" wx:for="{{newPrograms.match}}" wx:key="_id">{{item.school}}（{{item.fitScore}}分）</text>
  </view>
  <view wx:if="{{newPrograms.safety.length > 0}}">
    <text class="sim-diff-section-title">新增保底:</text>
    <text class="sim-diff-item" wx:for="{{newPrograms.safety}}" wx:key="_id">{{item.school}}（{{item.fitScore}}分）</text>
  </view>
  <view wx:if="{{upgradedPrograms.length > 0}}">
    <text class="sim-diff-section-title">提升档位:</text>
    <text class="sim-diff-item" wx:for="{{upgradedPrograms}}" wx:key="_id">{{item.school}}：{{item.from}} → {{item.to}}</text>
  </view>
  <view wx:if="{{downgradedPrograms.length > 0}}">
    <text class="sim-diff-section-title">下降档位:</text>
    <text class="sim-diff-item" wx:for="{{downgradedPrograms}}" wx:key="_id">{{item.school}}：{{item.from}} → {{item.to}}</text>
  </view>
</view>

<!-- 模拟按钮 -->
<button class="btn btn-primary" bindtap="onSimulate" loading="{{simulating}}" disabled="{{simulating}}">开始模拟</button>
<button class="btn btn-light" bindtap="onReset">重置</button>
```

Keep the TODO, history, consult sections unchanged.

- [ ] **Step 4: Add wxss styles**

Add to `pages/simulator/simulator.wxss`:

```css
.sim-pool-delta { font-size: 12px; font-weight: 600; }
.sim-pool-delta.up { color: var(--c-accent); }
.sim-pool-delta.down { color: #b4633a; }
.sim-diff-total { display: block; margin-top: 8px; font-size: 13px; font-weight: 600; color: var(--c-ink); }
.sim-diff-section-title { display: block; margin-top: 12px; font-size: 12px; font-weight: 600; color: var(--c-ink-2); }
.sim-diff-item { display: block; font-size: 12px; color: var(--c-ink-3); margin-top: 4px; }
```

- [ ] **Step 5: Run regression tests**

```bash
node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/match-allocation-v2.test.js
node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/login-wxprofile.test.js
node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/login-config.test.js
node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/profile-step5-chips.test.js
```

- [ ] **Step 6: Commit**

```bash
git add pages/simulator/ cloudfunctions/simulateMatcher/
git commit -m "feat: update simulator with cloud match simulation"
```

---

### Integration Verification

1. Deploy `simulateMatcher` cloud function in WeChat DevTools
2. Deploy `saveProfile` and `matchPrograms` (they also got calcDiff update)
3. Open simulator — check baseline loads from `users.matchResult`
4. Adjust slider values (e.g. increase GPA)
5. Click 「开始模拟」— check diff displays correctly
6. Check new/upgraded/downgraded programs appear correctly
7. Click 「重置」— verify it resets to baseline
