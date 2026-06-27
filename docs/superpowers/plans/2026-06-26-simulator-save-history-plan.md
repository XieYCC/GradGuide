# Simulator Save & History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add save-with-name modal, store full simResult to cloud, view saved results in a match-page-like detail view.

**Architecture:** Modify `saveSimResult` cloud function to accept `name`, `simResult`, `diff`, `newPrograms`, `upgradedPrograms`, `downgradedPrograms`, `score`. Add a custom modal overlay to the simulator page. Add a new page `sim-history-detail` for viewing saved results.

**Tech Stack:** WeChat Mini Program cloud functions, wx-server-sdk, native page/WXML/WXSS.

## Global Constraints

- Save modal must be an in-page overlay, not a wx.showModal prompt (no input field).
- `simResult` contains the full reach/match/safety arrays with all program fields and fitScore.
- The new `sim-history-detail` page layout mirrors `pages/match/match.wxml` style (three-tier display).
- `saveSimResult` cloud function must preserve backward compatibility (existing saved records still readable).
- WXML cannot use `=>`, `?.`, `&&` in expressions.
- The `app.json` pages array must include the new page `pages/sim-history-detail/sim-history-detail`.

---

## File Structure

**New pages:**
- `pages/sim-history-detail/sim-history-detail.js`
- `pages/sim-history-detail/sim-history-detail.wxml`
- `pages/sim-history-detail/sim-history-detail.wxss`
- `pages/sim-history-detail/sim-history-detail.json`

**Modified:**
- `cloudfunctions/saveSimResult/index.js` — extend to accept `name`, `simResult`, etc.
- `pages/simulator/simulator.js` — add save modal logic and update onLoadHistory
- `pages/simulator/simulator.wxml` — add modal overlay and update history list
- `pages/simulator/simulator.wxss` — add modal styles and score-card margin
- `app.json` — add `pages/sim-history-detail/sim-history-detail` to pages array

---

### Task 1: Modify saveSimResult cloud function

**Files:**
- Modify: `cloudfunctions/saveSimResult/index.js`

**Interfaces:**
- Consumes: `{ name, score, diff, newPrograms, upgradedPrograms, downgradedPrograms, simResult: { reach, match, safety } }`
- Produces: `{ code: 0, message: '保存成功' }`

- [ ] **Step 1: Rewrite saveSimResult/index.js**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function fmtDate() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { name, score, diff, newPrograms, upgradedPrograms, downgradedPrograms, simResult } = event

  if (!simResult) {
    return { code: -1, message: 'simResult 不能为空' }
  }

  const record = {
    name: name || `模拟结果 ${fmtDate()}`,
    timestamp: fmtDate(),
    score: score || 0,
    diff: diff || {},
    newPrograms: newPrograms || { reach: [], match: [], safety: [] },
    upgradedPrograms: upgradedPrograms || [],
    downgradedPrograms: downgradedPrograms || [],
    simResult: simResult
  }

  await db.collection('users').where({
    _openid: OPENID
  }).update({
    data: {
      simHistory: db.command.push(record),
      updatedAt: db.serverDate()
    }
  })

  return { code: 0, message: '保存成功' }
}
```

- [ ] **Step 2: Deploy**

```bash
"/d/Program Files (x86)/Tencent/微信web开发者工具/cli.bat" cloud functions deploy --project "D:\Users\XieYC\claude-workspace\GradGuide\miniprogram" --env cloud1-d7guh4c7wcad0635c --names saveSimResult --remote-npm-install
```

- [ ] **Step 3: Commit**

```bash
git add cloudfunctions/saveSimResult/
git commit -m "feat: extend saveSimResult to store name and full simResult"
```

---

### Task 2: Create sim-history-detail page

**Files:**
- Create: `pages/sim-history-detail/sim-history-detail.js`
- Create: `pages/sim-history-detail/sim-history-detail.wxml`
- Create: `pages/sim-history-detail/sim-history-detail.wxss`
- Create: `pages/sim-history-detail/sim-history-detail.json`
- Modify: `app.json`

- [ ] **Step 1: Create sim-history-detail.json**

```json
{
  "navigationBarTitleText": "历史模拟详情"
}
```

- [ ] **Step 2: Create sim-history-detail.wxml**

```xml
<view class="page-history-detail">
  <view class="history-detail-header" wx:if="{{detail}}">
    <text class="history-detail-name">{{detail.name}}</text>
    <text class="history-detail-time">{{detail.timestamp}}</text>
    <text class="history-detail-score">综合评分: {{detail.score}}</text>
  </view>

  <text class="history-detail-empty" wx:if="{{!detail}}">数据异常</text>

  <!-- 冲刺 -->
  <view class="tier-section" wx:if="{{detail && detail.simResult && detail.simResult.reach.length > 0}}">
    <view class="tier-header">
      <view class="tier-title"><text>冲刺（{{detail.simResult.reach.length}}）</text></view>
    </view>
    <view class="tier-grid">
      <view class="program-card card" wx:for="{{detail.simResult.reach}}" wx:key="_id">
        <view class="program-top">
          <view class="program-info">
            <text class="program-school">{{item.school}}</text>
            <text class="program-rank">{{item.rank}}</text>
          </view>
          <view class="program-tier-badge tier-badge-reach">
            <text>{{item.fitScore}} 分</text>
          </view>
        </view>
        <view class="program-details">
          <view class="program-detail-item"><text>均 GPA {{item.avgGpa}}</text></view>
          <view class="program-detail-item"><text>TOEFL ≥ {{item.toefl}}</text></view>
          <view class="program-detail-item"><text>GRE: {{item.gre}}</text></view>
          <view class="program-detail-item"><text>DDL: {{item.deadline}}</text></view>
          <view class="program-detail-item"><text>学费: {{item.tuition}}</text></view>
          <view class="program-detail-item"><text>学制: {{item.duration}}</text></view>
        </view>
        <view class="program-reasons" wx:if="{{item.reasons && item.reasons.length}}">
          <text class="program-reason" wx:for="{{item.reasons}}" wx:for-item="r" wx:key="*this">{{r}}</text>
        </view>
        <view class="program-risks" wx:if="{{item.risks && item.risks.length}}">
          <text class="program-risk" wx:for="{{item.risks}}" wx:for-item="r" wx:key="*this">{{r}}</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 匹配 -->
  <view class="tier-section" wx:if="{{detail && detail.simResult && detail.simResult.match.length > 0}}">
    <view class="tier-header">
      <view class="tier-title"><text>匹配（{{detail.simResult.match.length}}）</text></view>
    </view>
    <view class="tier-grid">
      <view class="program-card card" wx:for="{{detail.simResult.match}}" wx:key="_id">
        <view class="program-top">
          <view class="program-info">
            <text class="program-school">{{item.school}}</text>
            <text class="program-rank">{{item.rank}}</text>
          </view>
          <view class="program-tier-badge tier-badge-match">
            <text>{{item.fitScore}} 分</text>
          </view>
        </view>
        <view class="program-details">...</view>
        <view class="program-reasons" wx:if="{{item.reasons && item.reasons.length}}">
          <text class="program-reason" wx:for="{{item.reasons}}" wx:for-item="r" wx:key="*this">{{r}}</text>
        </view>
        <view class="program-risks" wx:if="{{item.risks && item.risks.length}}">
          <text class="program-risk" wx:for="{{item.risks}}" wx:for-item="r" wx:key="*this">{{r}}</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 保底 -->
  <view class="tier-section" wx:if="{{detail && detail.simResult && detail.simResult.safety.length > 0}}">
    <view class="tier-header">
      <view class="tier-title"><text>保底（{{detail.simResult.safety.length}}）</text></view>
    </view>
    <view class="tier-grid">
      <view class="program-card card" wx:for="{{detail.simResult.safety}}" wx:key="_id">
        <!-- same structure as reach/match -->
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 3: Create sim-history-detail.js**

```js
Page({
  data: {
    detail: null
  },

  onLoad(options) {
    if (options.data) {
      try {
        const detail = JSON.parse(decodeURIComponent(options.data))
        this.setData({ detail })
      } catch (e) {
        console.error('[sim-history-detail] parse failed', e)
      }
    }
  }
})
```

- [ ] **Step 4: Create sim-history-detail.wxss**

```css
.page-history-detail {
  padding: 16px;
  min-height: 100vh;
  background: var(--c-surface);
}
.history-detail-header {
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid var(--c-line);
  margin-bottom: 16px;
}
.history-detail-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--c-ink);
  display: block;
}
.history-detail-time {
  font-size: 11px;
  color: var(--c-ink-3);
  display: block;
  margin-top: 4px;
}
.history-detail-score {
  font-size: 13px;
  color: var(--c-primary);
  font-weight: 600;
  display: block;
  margin-top: 6px;
}
.history-detail-empty {
  display: block;
  text-align: center;
  padding: 40px;
  font-size: 14px;
  color: var(--c-ink-3);
}
.tier-section { margin-bottom: 16px; }
.tier-header { margin-bottom: 8px; }
.tier-title { font-size: 16px; font-weight: 700; color: var(--c-ink); }
.tier-grid { display: flex; flex-direction: column; gap: 12px; }
```

- [ ] **Step 5: Add page to app.json**

```json
"pages/sim-history-detail/sim-history-detail",
```

(Insert before "pages/simulator/simulator" or at end of array, maintaining readability.)

- [ ] **Step 6: Commit**

```bash
git add pages/sim-history-detail/ app.json
git commit -m "feat: add sim-history-detail page for viewing saved results"
```

---

### Task 3: Update simulator page with save modal and history

**Files:**
- Modify: `pages/simulator/simulator.js`
- Modify: `pages/simulator/simulator.wxml`
- Modify: `pages/simulator/simulator.wxss`

**Interfaces:**
- Consumes: `getSimHistory` cloud function returns array of records with `name`, `timestamp`, `score`, `simResult`
- Produces: Save modal flow, updated history list with name + view action

- [ ] **Step 1: Add save modal state fields to data in simulator.js**

```js
data: {
  // ... existing fields
  showSaveModal: false,
  saveName: ''
}
```

- [ ] **Step 2: Add save/close/input methods**

```js
onSaveResult() {
  if (!this.data.simResult) {
    wx.showToast({ title: '请先进行一次模拟', icon: 'none' })
    return
  }
  const defaultName = '模拟结果 ' + new Date().toISOString().slice(0, 10)
  this.setData({ showSaveModal: true, saveName: defaultName })
},

closeSaveModal() {
  this.setData({ showSaveModal: false })
},

onSaveNameInput(e) {
  this.setData({ saveName: e.detail.value })
},

async confirmSave() {
  if (!this.data.saveName.trim()) {
    wx.showToast({ title: '请输入名称', icon: 'none' })
    return
  }

  try {
    await wx.cloud.callFunction({
      name: 'saveSimResult',
      data: {
        name: this.data.saveName.trim(),
        diff: this.data.diff,
        newPrograms: this.data.newPrograms,
        upgradedPrograms: this.data.upgradedPrograms,
        downgradedPrograms: this.data.downgradedPrograms,
        simResult: this.data.simResult,
        score: this.data.score
      }
    })
    wx.showToast({ title: '保存成功', icon: 'success' })
    this.setData({ showSaveModal: false })
    this.loadHistory()
  } catch (err) {
    console.error('[save] failed', err)
    wx.showToast({ title: '保存失败', icon: 'none' })
  }
}
```

- [ ] **Step 3: Update onLoadHistory to navigate to detail page**

```js
onLoadHistory(e) {
  const idx = e.currentTarget.dataset.index
  const record = this.data.history[idx]
  if (!record) return
  const dataStr = encodeURIComponent(JSON.stringify(record))
  wx.navigateTo({ url: '/pages/sim-history-detail/sim-history-detail?data=' + dataStr })
}
```

- [ ] **Step 4: Update onDeleteHistory (unchanged, keep existing)**

- [ ] **Step 5: Update history list display in simulator.wxml**

Replace the existing history item entry:

```xml
<view class="sim-history-item" wx:for="{{history}}" wx:for-index="idx" wx:key="index">
  <view class="sim-history-meta">
    <text class="sim-history-name" wx:if="{{item.name}}">{{item.name}}</text>
    <text class="sim-history-time">{{item.timestamp}}</text>
    <view class="sim-history-score-row">
      <text class="sim-history-score">评分: {{item.score}}</text>
      <text class="sim-history-tier">冲刺 {{item.simResult?.reach?.length || 0}} / 匹配 {{item.simResult?.match?.length || 0}} / 保底 {{item.simResult?.safety?.length || 0}}</text>
    </view>
  </view>
  <view class="sim-history-actions">
    <text class="sim-history-load" data-index="{{idx}}" bindtap="onLoadHistory">查看</text>
    <text class="sim-history-del" data-timestamp="{{item.timestamp}}" bindtap="onDeleteHistory">删除</text>
  </view>
</view>
```

Note: Replace `item.simResult?.reach?.length` with proper ternary in WXML since `?.` is not supported:

```xml
<text class="sim-history-tier">冲刺 {{item.simResult && item.simResult.reach ? item.simResult.reach.length : 0}} / 匹配 {{item.simResult && item.simResult.match ? item.simResult.match.length : 0}} / 保底 {{item.simResult && item.simResult.safety ? item.simResult.safety.length : 0}}</text>
```

- [ ] **Step 6: Add save modal to simulator.wxml (at end of file, before closing page-simulator)**

```xml
<!-- 保存命名弹窗 -->
<view class="sim-save-modal" wx:if="{{showSaveModal}}">
  <view class="sim-save-modal-mask" bindtap="closeSaveModal"></view>
  <view class="sim-save-modal-body">
    <text class="sim-save-modal-title">保存模拟结果</text>
    <input class="sim-save-modal-input" value="{{saveName}}" bindinput="onSaveNameInput" placeholder="输入模拟结果名称" />
    <view class="sim-save-modal-actions">
      <button class="btn btn-light" bindtap="closeSaveModal">取消</button>
      <button class="btn btn-primary" bindtap="confirmSave">确认保存</button>
    </view>
  </view>
</view>
```

- [ ] **Step 7: Add modal styles to simulator.wxss**

```css
.sim-save-modal {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sim-save-modal-mask {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
}
.sim-save-modal-body {
  position: relative;
  width: 300px;
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  z-index: 1;
}
.sim-save-modal-title {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: var(--c-ink);
  margin-bottom: 16px;
  text-align: center;
}
.sim-save-modal-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--c-line);
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  margin-bottom: 20px;
}
.sim-save-modal-actions {
  display: flex;
  gap: 12px;
}
.sim-save-modal-actions .btn {
  flex: 1;
}
```

- [ ] **Step 8: Add score-card margin**

```css
.sim-score-card {
  padding: 24px;
  margin-bottom: 16px;
}
```

- [ ] **Step 9: Add history name style**

```css
.sim-history-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ink);
  display: block;
  margin-bottom: 2px;
}
```

- [ ] **Step 10: Verify syntax**

```bash
node -c /d/Users/XieYC/claude-workspace/GradGuide/miniprogram/pages/simulator/simulator.js
```

- [ ] **Step 11: Commit**

```bash
git add pages/simulator/ app.json
git commit -m "feat: add save modal and history view to simulator"
```
