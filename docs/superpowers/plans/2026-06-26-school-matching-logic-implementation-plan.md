# School Matching Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the cloud-based school matching logic as designed in the spec — `saveProfile` triggers matching, result cached in `users.matchResult`, match page reads cache.

**Architecture:** Adds `selectivityBand` to program data, creates `matchPrograms` cloud function with shared matching logic, modifies `saveProfile` to trigger match calculation, updates match page to read `users.matchResult` instead of running programs locally.

**Tech Stack:** WeChat Mini Program, wx-server-sdk, Tencent CloudBase

## Global Constraints

- No npm install or build step needed at project level — wx-server-sdk is already in each cloud function's dependencies
- Cloud function `package.json` must include `"wx-server-sdk": "~3.0.4"`
- All new cloud functions use shared matching logic — duplicate the `match-logic.js` file if needed (wx-server-sdk does not support cross-cloud function requires)
- Match page still needs local fallback (classifyProgram) when cloud fails
- `selectivityBand` must be added to both local `utils/data.js` and cloud database `programs` collection
- WXML cannot use `=>`, `?.`, `&&` in expressions — all logic must be pre-computed in JS

---

### File Structure

**Modified files:**
- `utils/data.js` — add `selectivityBand` to all 21 programs
- `cloudfunctions/saveProfile/index.js` — add matchResult trigger after save
- `cloudfunctions/getUser/index.js` — add `matchResult` to return fields
- `pages/match/match.js` — read `users.matchResult` instead of local classifyProgram
- `pages/profile-step3/profile-step3.js` — fix empty input for `toefl` and `gre` (parseInt vs parseFloat)
- `pages/profile-step3/profile-step3.wxml` — update field label/type for TOEFL and GRE
- `pages/match/match.wxml` — use matchResult data (reach/match/safety) from cloud

**Created files:**
- `cloudfunctions/matchPrograms/index.js` — new cloud function matching logic + program data reading
- `cloudfunctions/saveProfile/match-logic.js` — shared fitScore/match logic (copied into saveProfile)
- `cloudfunctions/matchPrograms/package.json` — dependencies for new cloud function

---

### Task 1: Add `selectivityBand` to programs data

**Files:**
- Modify: `utils/data.js`

- [ ] **Step 1: Add selectivityBand to each program in utils/data.js**

Add `selectivityBand` field to all 21 programs in the `PROGRAMS` array. The additions are:

```js
// id:1  CMU CS
{ ...existingFields, selectivityBand: 'elite' }
// id:2  Columbia CS
{ ...existingFields, selectivityBand: 'high' }
// id:3  USC CS
{ ...existingFields, selectivityBand: 'mid' }
// id:4  NEU CS
{ ...existingFields, selectivityBand: 'mid' }
// id:5  Stevens CS
{ ...existingFields, selectivityBand: 'friendly' }
// id:6  HKU CS
{ ...existingFields, selectivityBand: 'elite' }
// id:7  CUHK CS
{ ...existingFields, selectivityBand: 'mid' }
// id:8  HKUST CS
{ ...existingFields, selectivityBand: 'mid' }
// id:9  Cambridge CS
{ ...existingFields, selectivityBand: 'elite' }
// id:10  IC CS
{ ...existingFields, selectivityBand: 'elite' }
// id:11  Edinburgh CS
{ ...existingFields, selectivityBand: 'mid' }
// id:12  KCL CS
{ ...existingFields, selectivityBand: 'friendly' }
// id:13  Northwestern MKT
{ ...existingFields, selectivityBand: 'elite' }
// id:14  NYU MKT
{ ...existingFields, selectivityBand: 'high' }
// id:15  BU MKT
{ ...existingFields, selectivityBand: 'mid' }
// id:16  HKU MKT
{ ...existingFields, selectivityBand: 'high' }
// id:17  CUHK MKT
{ ...existingFields, selectivityBand: 'mid' }
// id:18  CityU MKT
{ ...existingFields, selectivityBand: 'friendly' }
// id:19  LSE MKT
{ ...existingFields, selectivityBand: 'elite' }
// id:20  Manchester MKT
{ ...existingFields, selectivityBand: 'mid' }
// id:21  Warwick MKT
{ ...existingFields, selectivityBand: 'friendly' }
```

Each object now looks like:

```js
{ id:1, school:'Carnegie Mellon University', shortName:'CMU', country:'US', region:'美国', major:'CS', rank:'US #3', minGpa:3.7, avgGpa:3.85, toefl:100, gre:'325+', tier:'reach', deadline:'12月10日', tuition:'$70,000/年', duration:'16个月', highlight:'CS 全美第一，强调科研背景', selectivityBand:'elite' },
```

- [ ] **Step 2: Verify the file parses correctly**

```bash
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/utils/data.js
```

Expected: No syntax errors.

- [ ] **Step 3: Commit**

```bash
git add utils/data.js
git commit -m "feat: add selectivityBand to all 21 programs"
```

---

### Task 2: Initialize `selectivityBand` in cloud database

**Files:**
- Create: `scripts/initSelectivityBand.js`

**Interfaces:**
- Runs once to update cloud database `programs` collection with `selectivityBand` field for existing records.
- Uses tcb CLI to update each program document.

- [ ] **Step 1: Write the init script**

```js
// scripts/initSelectivityBand.js
// Run: node scripts/initSelectivityBand.js
// Uses tcb rest api to update selectivityBand
const http = require('https');
const fs = require('fs');
const path = require('path');

// Read local programs
const { PROGRAMS } = require('../utils/data');

// Map id to selectivityBand
const bandMap = {};
PROGRAMS.forEach(p => { bandMap[p.id] = p.selectivityBand; });

// Output as a script for CloudBase shell
// Since we can't bulk update from node without auth, generate a shell file
const lines = PROGRAM.map(p => {
  const escaped = `{\\"shortName\\":\\"${p.shortName || ''}\\"}`;
  return `tcb db nosql execute -e cloud1-d7guh4c7wcad0635c --command '[{"TableName":"programs","CommandType":"UPDATE","Command":"{\\"update\\":\\"programs\\",\\"updates\\":[{\\"q\\":{\\"shortName\\":\\"${p.shortName}\\"},\\"u\\":{\\"$set\\":{\\"selectivityBand\\":\\"${p.selectivityBand}\\"}}}]}"}]' --json`;
}).join('\n');

console.log(lines);
```

Actually this is too complex. Simpler approach: use WeChat DevTools to update manually.

- [ ] **Step2 (Simplified): Manually update cloud programs via DevTools**

1. Open CloudBase console → Database → `programs` collection
2. For each document, click Edit → add `"selectivityBand": "elite"|"high"|"mid"|"friendly"` field
3. Save

Alternatively, run this for each program via tcb CLI:

```bash
tcb db nosql execute -e cloud1-d7guh4c7wcad0635c --command '[{"TableName":"programs","CommandType":"UPDATE","Command":"{\\"update\\":\\"programs\\",\\"updates\\":[{\\"q\\":{\\"shortName\\":\\"CMU\\"},\\"u\\":{\\"$set\\":{\\"selectivityBand\\":\\"elite\\"}}}]}"}]' --json
```

Update all 21 programs with the matching `selectivityBand` from Task 1.

---

### Task 3: Create shared match-logic.js

**Files:**
- Create: `cloudfunctions/matchPrograms/match-logic.js`
- (Will be copied to `cloudfunctions/saveProfile/match-logic.js` in Task 5)

**Interfaces:**
- Consumes: `program` object, `profile` object
- Produces: `{ fitScore, reasons, risks, tier, isExtremeReach }`

- [ ] **Step 1: Write the `getSelectivityBand` fallback**

```js
function getSelectivityBand(program) {
  if (program.selectivityBand) return program.selectivityBand
  if (program.tier === 'reach' && /#\d{1,2}/.test(program.rank)) return 'elite'
  if (program.tier === 'reach') return 'high'
  if (program.tier === 'match' && /#\d{1,3}/.test(program.rank)) return 'mid'
  return 'friendly'
}
```

- [ ] **Step 2: Write the `BAND_MAP` and `qualifiesForExtremeReach`**

```js
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
```

- [ ] **Step 3: Write the `filterBySchoolBand` function**

```js
function filterBySchoolBand(programs, schoolLevel, profile) {
  const bands = BAND_MAP[schoolLevel] || { visible: ['friendly'], extremeReach: ['mid'] }

  let candidates = programs.filter(p => bands.visible.includes(getSelectivityBand(p)))
  let extremeCount = 0

  if (qualifiesForExtremeReach(profile)) {
    let extras = programs.filter(p =>
      bands.extremeReach.includes(getSelectivityBand(p)) &&
      !candidates.includes(p)
    )
    // Sort by tier priority: reach first (higher value for dream school)
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
```

- [ ] **Step 4: Write `calcStandardizedScore`**

```js
function calcStandardizedScore(program, profile) {
  const userToefl = profile.toefl || 0
  const userGre = profile.gre || 0
  const reqToefl = program.toefl || 0
  const reqGreStr = program.gre || ''

  let score = 60

  // TOEFL penalty: each 2 points below = -1
  if (userToefl < reqToefl) {
    const gap = reqToefl - userToefl
    score -= Math.max(0, Math.ceil(gap / 2))
  }

  // GRE penalty (only if program requires it)
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
```

- [ ] **Step 5: Write `calcSchoolScore`**

```js
const SCHOOL_LEVELS = ['985 · C9 联盟', '985', '211', '双一流', '海外本科', '中外合办', '双非一本', '双非二本']
const BAND_LEVELS = ['elite', 'high', 'mid', 'friendly']

function calcSchoolScore(schoolLevel, selectivityBand) {
  const ui = SCHOOL_LEVELS.indexOf(schoolLevel)
  const bi = BAND_LEVELS.indexOf(selectivityBand)
  if (ui === -1) return 0
  if (bi === -1) return 0

  const diff = bi - ui

  if (diff <= 0) return 12
  if (diff === 1) return 8
  if (diff === 2) return 2
  if (diff === 3) return -8
  return -4
}
```

- [ ] **Step 6: Write `calcGpaScore`**

```js
function calcGpaScore(program, userGpa) {
  const avgGpa = program.avgGpa || 3.5
  const gap = userGpa - avgGpa

  if (gap >= 0.3) return 10
  if (gap >= 0.1) return 6
  if (gap >= -0.1) return 4
  if (gap >= -0.3) return 0
  return -5
}
```

- [ ] **Step 7: Write `calcBackgroundScore`**

```js
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
```

- [ ] **Step 8: Write `calcPreferenceScore`**

```js
function calcPreferenceScore(program, profile) {
  let score = 0
  const targetRegions = profile.targetRegions || []
  const targetMajors = profile.targetMajors || []

  if (targetRegions.includes(program.region)) score += 2
  if (targetMajors.some(m => program.major.includes(m) || m.includes(program.major))) score += 2
  if (profile.priority === program.highlight) score += 1

  return Math.min(5, score)
}
```

- [ ] **Step 9: Write `generateReasons` and `generateRisks`**

```js
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
```

- [ ] **Step 10: Write `calcFitScore` that calls all sub-scores**

```js
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
```

- [ ] **Step 11: Write `runMatch` — the main orchestrator**

```js
function runMatch(programs, profile) {
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

  const reach = scored.filter(p => p.fitScore >= 50 && p.fitScore < 70)
    .sort((a, b) => b.fitScore - a.fitScore)
  const match = scored.filter(p => p.fitScore >= 70 && p.fitScore < 80)
    .sort((a, b) => b.fitScore - a.fitScore)
  const safety = scored.filter(p => p.fitScore >= 80 && p.fitScore <= 90)
    .sort((a, b) => b.fitScore - a.fitScore)

  return {
    reach, match, safety,
    extremeReachCount: extremeCount,
    version: 'v1',
    calculatedAt: new Date()
  }
}
```

- [ ] **Step 12: Write the module exports**

```js
module.exports = { runMatch, calcFitScore, getSelectivityBand, BAND_MAP, qualifiesForExtremeReach, filterBySchoolBand }
```

- [ ] **Step 13: Verify file**

```bash
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/matchPrograms/match-logic.js
```

Expected: No syntax errors.

- [ ] **Step 14: Commit**

```bash
git add cloudfunctions/matchPrograms/match-logic.js
git commit -m "feat: add shared match-logic.js with fitScore, band filtering, and reason generation"
```

---

### Task 4: Create matchPrograms cloud function

**Files:**
- Create: `cloudfunctions/matchPrograms/index.js`
- Create: `cloudfunctions/matchPrograms/package.json`
- Test: via tcb fn invoke

**Interfaces:**
- Consumes: none (self-reads user profile from database via OPENID)
- Produces: `{ reach, match, safety, extremeReachCount }`

- [ ] **Step 1: Write index.js**

```js
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
  const programsRes = await db.collection('programs').where({ enabled: true }).get()
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
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "matchPrograms",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.4"
  }
}
```

- [ ] **Step 3: Verify syntax**

```bash
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/matchPrograms/index.js
```

Expected: No syntax errors.

- [ ] **Step 4: Deploy cloud function**

```bash
"/d/Program Files (x86)/Tencent/微信web开发者工具/cli.bat" cloud functions deploy --project "D:\Users\XieYC\claude-workspace\GradGuide\miniprogram" --env cloud1-d7guh4c7wcad0635c --names matchPrograms --remote-npm-install
```

Expected: Deploy success (or handle deployment state as learned from prior issues).

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/matchPrograms/
git commit -m "feat: create matchPrograms cloud function"
```

---

### Task 5: Modify saveProfile to trigger match calculation

**Files:**
- Create: `cloudfunctions/saveProfile/match-logic.js` (copy from matchPrograms/match-logic.js)
- Modify: `cloudfunctions/saveProfile/index.js`

**Interfaces:**
- Consumes: `{ profile }` (existing), saves match result to db
- Produces: match result saved to `users.matchResult` field

- [ ] **Step 1: Copy match-logic.js into saveProfile cloud function**

```bash
cp /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/matchPrograms/match-logic.js /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/saveProfile/match-logic.js
```

- [ ] **Step 2: Modify saveProfile/index.js — import match-logic and add trigger after save**

Read the existing `index.js` and append after the existing save-success return. The key change is adding match calculation after both create and update paths:

```js
// cloudfunctions/saveProfile/index.js (modified)
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { runMatch, getSelectivityBand } = require('./match-logic')

// ... existing code unchanged until the return points ...

// After successful create (line ~34):
// Add before the return:
try {
  const progRes = await db.collection('programs').where({ enabled: true }).get()
  const programs = progRes.data || []
  programs.forEach(p => { if (!p.selectivityBand) p.selectivityBand = getSelectivityBand(p) })
  const matchResult = runMatch(programs, mergedProfile)
  matchResult.version = 'v1'
  await db.collection('users').where({ _openid: OPENID }).update({
    data: { matchResult, matchResultUpdatedAt: db.serverDate() }
  })
} catch (matchErr) {
  console.error('[saveProfile] match calculation failed', matchErr)
}

// After successful update (line ~60):
// Add the same block before the return.
```

The exact insertion point is after `return { code: 0, message: '创建并保存成功', created: true, id: addRes._id }` and after `return { code: 0, message: '保存成功', updated: res.stats.updated }`.

Append the try-catch match calculation block before each return. The profile used for match should be the saved/merged profile.

The full modified file should include the `runMatch` call right before each success return, reading programs from the database:

```js
// match calculation helper (add near top, after requires)
async function triggerMatch(OPENID, profile) {
  try {
    const progRes = await db.collection('programs').where({ enabled: true }).get()
    const programs = progRes.data || []
    programs.forEach(p => { if (!p.selectivityBand) p.selectivityBand = getSelectivityBand(p) })
    const matchResult = runMatch(programs, profile)
    matchResult.version = 'v1'
    await db.collection('users').where({ _openid: OPENID }).update({
      data: { matchResult, matchResultUpdatedAt: db.serverDate() }
    })
  } catch (e) {
    console.error('[saveProfile] match calc error', e)
  }
}

// Then in each success path, add:
await triggerMatch(OPENID, mergedProfile)
```

- [ ] **Step 3: Verify syntax**

```bash
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/cloudfunctions/saveProfile/index.js
```

- [ ] **Step 4: Deploy saveProfile**

```bash
"/d/Program Files (x86)/Tencent/微信web开发者工具/cli.bat" cloud functions deploy --project "D:\Users\XieYC\claude-workspace\GradGuide\miniprogram" --env cloud1-d7guh4c7wcad0635c --names saveProfile --remote-npm-install
```

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/saveProfile/
git commit -m "feat: saveProfile triggers match calculation after save"
```

---

### Task 6: Modify getUser to return matchResult

**Files:**
- Modify: `cloudfunctions/getUser/index.js`

**Interfaces:**
- Produces: `{ profile, favorites, simHistory, wxProfile, matchResult }`

- [ ] **Step 1: Add matchResult to getUser return**

Existing code returns `{ profile, favorites, simHistory, wxProfile }`. Add `matchResult`:

```js
return {
  profile: user.profile || {},
  favorites: user.favorites || [],
  simHistory: user.simHistory || [],
  wxProfile: user.wxProfile || {},
  matchResult: user.matchResult || null  // add this line
}
```

- [ ] **Step 2: Deploy getUser**

```bash
"/d/Program Files (x86)/Tencent/微信web开发者工具/cli.bat" cloud functions deploy --project "D:\Users\XieYC\claude-workspace\GradGuide\miniprogram" --env cloud1-d7guh4c7wcad0635c --names getUser --remote-npm-install
```

- [ ] **Step 3: Commit**

```bash
git add cloudfunctions/getUser/index.js
git commit -m "feat: getUser returns matchResult"
```

---

### Task 7: Update match page to use matchResult

**Files:**
- Modify: `pages/match/match.js`
- Modify: `pages/match/match.wxml`

**Interfaces:**
- Consumes: `getUser` cloud function returns `matchResult`
- Produces: page displays reach/match/safety from matchResult

- [ ] **Step 1: Replace match.js render logic**

Rewrite `loadData()` to read from `getUser => matchResult`, with fallback:

```js
// pages/match/match.js
// Keep existing requires and imports. Modify loadData and renderTiers.

async loadData() {
  const profile = app.globalData.userProfile || {}
  const targetRegions = profile.targetRegions || []
  const targetMajors = profile.targetMajors || []
  const regionText = targetRegions.join('/')
  const majorText = targetMajors.join('/')
  const showTargetInfo = !!(profile.schoolLevel || profile.gpa || targetRegions.length)
  const targetInfoText = [regionText, majorText].filter(Boolean).join(' · ')
  this.setData({ userProfile: profile, showTargetInfo, targetInfoText })

  // Try to read matchResult from cloud
  try {
    const matchRes = await wx.cloud.callFunction({ name: 'getUser' })
    const match = matchRes.result?.matchResult

    if (match && match.reach) {
      // matchResult exists — use it directly
      this.setData({
        reach: match.reach || [],
        match: match.match || [],
        safety: match.safety || [],
        extremeReachCount: match.extremeReachCount || 0,
        loading: false,
        noMatchData: false
      })
      return
    }

    // No matchResult yet — trigger calculation
    wx.showLoading({ title: '正在为您匹配...' })
    const calcRes = await wx.cloud.callFunction({ name: 'matchPrograms' })

    // Save matchResult to global cache for current session
    app.globalData.matchResult = calcRes.result || {}

    this.setData({
      reach: calcRes.result.reach || [],
      match: calcRes.result.match || [],
      safety: calcRes.result.safety || [],
      extremeReachCount: calcRes.result.extremeReachCount || 0,
      loading: false,
      noMatchData: false
    })
    wx.hideLoading()
  } catch (err) {
    console.error('[match] failed to load match result', err)
    wx.hideLoading()
    // Fallback: use local classifyProgram
    this.loadProgramsFallback()
  }
}

// Fallback using local classifyProgram
async loadProgramsFallback() {
  this.setData({ loading: true })
  try {
    const res = await wx.cloud.callFunction({
      name: 'getPrograms',
      data: { region: this.data.curRegion, major: this.data.curMajor }
    })
    let programs = res.result.list || []
    if (!programs.length) {
      const { PROGRAMS } = require('../../utils/data')
      programs = PROGRAMS
    }
    const { classifyProgram } = require('../../utils/util')
    const profile = this.data.userProfile || {}
    programs = programs.map(p => ({ ...p, tier: classifyProgram(p, profile) }))
    const tiers = ['reach', 'match', 'safety'].map(key => ({
      key,
      config: TIER_CONFIG[key],
      list: programs.filter(p => p.tier === key)
    }))
    const tierCounts = { reach: 0, match: 0, safety: 0 }
    tiers.forEach(t => { tierCounts[t.key] = t.list.length })
    this.setData({ tiers, tierCounts, loading: false })
  } catch (err) {
    console.error('[match] fallback failed', err)
    this.setData({ loading: false })
  }
}
```

Remove the old `renderTiers()`, `loadPrograms()`, and `loadFavorites()` methods (favorites are still needed, keep them). Keep `onLoad()`, `onShow()`, `loadFavorites()`, `toggleFavorite()`, `filterRegion()`, `filterMajor()`, navigation methods.

Update data block — add new fields:

```js
data: {
  curRegion: 'all',
  curMajor: 'all',
  programs: [],
  tierConfig: TIER_CONFIG,
  tierOrder: ['reach', 'match', 'safety'],
  userProfile: { school: '', schoolLevel: '', gpa: '', toefl: '', gre: '', targetRegions: [], targetMajors: [], research: [], internships: [] },
  reach: [],
  match: [],
  safety: [],
  tierCounts: { reach: 0, match: 0, safety: 0 },
  loading: true,
  noMatchData: true,
  favoriteIds: [],
  togglingIds: {}
}
```

- [ ] **Step 2: Update wxml to display matchResult**

Replace the main tier rendering section. Instead of `wx:for="{{tiers}}"`, render three sections:

```xml
<!-- 冲刺 -->
<view class="tier-section" wx:if="{{reach.length > 0}}">
  <view class="tier-header">
    <view class="tier-title">
      <text>冲刺（{{reach.length}}）</text>
    </view>
    <text class="tier-desc">录取概率 10%-30% · 建议重点冲刺</text>
  </view>
  <view class="tier-grid">
    <view class="program-card card" wx:for="{{reach}}" wx:key="_id">
      <!-- ... same program card structure as before ... -->
      <view class="program-top">
        <view class="program-info">
          <text class="program-school">{{item.school}}</text>
          <text class="program-rank">{{item.rank}}</text>
        </view>
        <view class="program-tier-badge tier-badge-reach">
          <text>{{item.fitScore}} 分</text>
        </view>
      </view>
      <!-- Keep the rest of the card structure from the existing wxml -->
    </view>
  </view>
</view>

<!-- 匹配 -->
<view class="tier-section" wx:elif="{{match.length > 0}}">
  <!-- Same structure as reach but with match tier -->

<!-- 保底 -->
<view class="tier-section" wx:elif="{{safety.length > 0}}">
  <!-- Same structure as reach but with safety tier -->
```

The program card should also show `reasons` and `risks`:

```xml
<view class="program-reasons" wx:if="{{item.reasons && item.reasons.length}}">
  <text class="program-reason" wx:for="{{item.reasons}}" wx:for-item="r" wx:key="*this">✅ {{r}}</text>
</view>
<view class="program-risks" wx:if="{{item.risks && item.risks.length}}">
  <text class="program-risk" wx:for="{{item.risks}}" wx:for-item="r" wx:key="*this">⚠️ {{r}}</text>
</view>
```

Also update the overview card to show dynamic tier counts:

```xml
<view class="overview-stats">
  <view class="overview-stat">
    <text class="overview-stat-num">{{reach.length}}</text>
    <text class="overview-stat-label">冲刺</text>
  </view>
  <view class="overview-stat">
    <text class="overview-stat-num">{{match.length}}</text>
    <text class="overview-stat-label">匹配</text>
  </view>
  <view class="overview-stat">
    <text class="overview-stat-num">{{safety.length}}</text>
    <text class="overview-stat-label">保底</text>
  </view>
</view>
```

- [ ] **Step 3: Update the overview card to show noMatchData state**

```xml
<view class="overview-card" wx:if="{{!noMatchData}}">
  <!-- existing overview card -->
</view>
<view class="overview-card overview-empty" wx:else>
  <text>请先完成个人信息填写，获取精准选校推荐</text>
  <button class="btn btn-primary" bindtap="goToProfile">填写信息</button>
</view>
```

- [ ] **Step 4: Verify syntax**

```bash
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/pages/match/match.js
```

- [ ] **Step 5: Commit**

```bash
git add pages/match/
git commit -m "feat: match page reads matchResult from cloud with local fallback"
```

---

### Task 8: Fix profile-step3 empty input handling for TOEFL/GRE

**Files:**
- Modify: `pages/profile-step3/profile-step3.js`

- [ ] **Step 1: Fix onNext to handle empty input correctly**

Current code:

```js
const toeflNum = parseInt(this.data.toefl, 10) || 0
const greNum = parseInt(this.data.gre, 10) || 0
```

Problem: When the input is an empty string `""`, `parseInt("", 10)` returns `NaN`, and `NaN || 0` returns `0`. This is fine for saving — it means "no data".

But there's another issue: `type="digit"` on the WXML `<input>` allows decimal input for TOEFL (IELTS band score can be 6.5, 7.0, 7.5 etc). So `parseInt` would truncate. Fix to `parseFloat`:

```js
const toeflNum = this.data.toefl === '' ? 0 : parseFloat(this.data.toefl) || 0
const greNum = this.data.gre === '' ? 0 : parseFloat(this.data.gre) || 0
```

Also apply same pattern to `gpa`:

```js
const gpaNum = this.data.gpa === '' ? 0 : parseFloat(this.data.gpa) || 0
```

- [ ] **Step 2: Verify syntax**

```bash
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/pages/profile-step3/profile-step3.js
```

- [ ] **Step 3: Commit**

```bash
git add pages/profile-step3/profile-step3.js
git commit -m "fix: use parseFloat for TOEFL/GRE inputs, handle empty string"
```

---

### Task 9: Run all regression tests

**Files:**
- Test: `tests/login-wxprofile.test.js`
- Test: `tests/login-config.test.js`
- Test: `tests/profile-step5-chips.test.js`
- Test: `tests/gpa-input.test.js`

- [ ] **Step 1: Run all existing tests**

```bash
node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/login-wxprofile.test.js && node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/login-config.test.js && node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/profile-step5-chips.test.js
```

Expected: All tests pass.

- [ ] **Step 2: Run GPA input test**

```bash
node /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/tests/gpa-input.test.js
```

(If doesn't exist, skip or write a quick one for empty string handling.)

- [ ] **Step 3: Commit final changes**

```bash
git add .
git commit -m "chore: run regression tests, all pass"
```

---

### Integration Verification

After deploying all cloud functions (matchPrograms, saveProfile, getUser), verify in WeChat DevTools:

1. **Save profile** → `saveProfile` should trigger match calculation
2. **Open match page** → should show reach/match/safety from matchResult
3. **Empty profile** → should show guide text + local fallback
4. **Update profile** → save → reopen match → should update automatically
5. **TOEFL/GRE inputs** → empty string and decimal values should work correctly
