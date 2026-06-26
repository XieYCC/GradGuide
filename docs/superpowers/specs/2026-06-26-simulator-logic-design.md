# GradGuide 提升模拟器逻辑设计

## 概述

将当前模拟器从硬编码 `calcScore` + `calcTier` + 静态 `unlockedList` 升级为与选校页共用的云端匹配算法。用户调整 GPA / TOEFL / GRE / 补强项目后，调云函数模拟运算，展示与真实 `users.matchResult` 的对比差异。

## 数据流

```text
用户打开模拟器
  ↓
读取 users.matchResult 作为 baseline
  ↓
展示当前真实选校结果（冲刺/匹配/保底项目列表）
  ↓
用户滑动 GPA / TOEFL / GRE 滑块或勾选补强 checkbox
  ↓
点击「开始模拟」按钮
  ↓
调用 simulateMatcher 云函数（传入模拟参数）
  ↓
云函数返回模拟后结果 + 与 baseline 的差异
  ↓
前端展示数量对比 + 新增/变化/减少的项目列表
  ↓
用户可再次调整参数并重新模拟
  ↓
退出模拟器 → 重置，不持久化模拟状态
```

## 云函数设计

### 新增：`simulateMatcher`

#### 输入

```json
{
  "gpa": 3.6,
  "toefl": 105,
  "gre": 325,
  "paper": true,
  "research": true,
  "intern": true,
  "award": false
}
```

所有字段可选。不传的字段，使用用户数据库真实档案对应值。

#### 执行逻辑

1. 通过 `cloud.getWXContext()` 获取 OPENID
2. 读取 `users` 集合，获取用户真实 profile
3. 合并传入的模拟覆盖参数：

```js
const simProfile = {
  ...realProfile,
  ...(gpa !== undefined && { gpa }),
  ...(toefl !== undefined && { toefl }),
  ...(gre !== undefined && { gre }),
  ...(paper !== undefined && { paper }),
  ...(research !== undefined && { research }),
  ...(intern !== undefined && { intern }),
  ...(award !== undefined && { award })
}
```

4. 读取 programs 集合（所有 enabled 项目）
5. 执行完整的 `runMatch` 流程：

```js
const { candidates, extremeCount } = filterBySchoolBand(programs, simProfile.schoolLevel, simProfile)
const scored = candidates.map(p => {
  const result = calcFitScore(p, simProfile)
  return { ...p, fitScore: result.fitScore, reasons: result.reasons, risks: result.risks }
})
const simResult = allocateBuckets(scored, simProfile)
```

6. 读取用户当前的 `matchResult` 作为 baseline
7. 对比模拟结果和 baseline，计算差异

#### 输出

```json
{
  "simResult": {
    "reach": [
      { "school": "Carnegie Mellon University", "fitScore": 65, ... },
      ...
    ],
    "match": [ ... ],
    "safety": [ ... ]
  },
  "diff": {
    "reach": { "baseline": 3, "after": 4, "delta": "+1" },
    "match": { "baseline": 8, "after": 10, "delta": "+2" },
    "safety": { "baseline": 4, "after": 4, "delta": "±0" },
    "totalDelta": "+3"
  },
  "newPrograms": {
    "reach": [ "Carnegie Mellon University" ],
    "match": [ "Imperial College London", "University of Edinburgh" ],
    "safety": []
  },
  "upgradedPrograms": [
    { "school": "Imperial College London", "from": "reach", "to": "match" }
  ],
  "downgradedPrograms": [
    { "school": "某某项目", "from": "match", "to": "safety" }
  ]
}
```

#### 差异字段说明

| 字段 | 含义 |
|---|---|
| `diff` | 各档数量变化摘要，给顶部卡片展示 |
| `newPrograms` | 本次模拟中新增进入 reach/match/safety 的项目 |
| `upgradedPrograms` | 从低档上升一档的项目（如冲刺→匹配） |
| `downgradedPrograms` | 从高档下降一档的项目（如匹配→冲刺） |

#### 新增/变化项目的判断逻辑

```js
function calcDiff(baseline, simResult) {
  const baselineReachIds = new Set(baseline.reach.map(p => p._id))
  const simReachIds = new Set(simResult.reach.map(p => p._id))

  const newReach = simResult.reach.filter(p => !baselineReachIds.has(p._id))
  // 同理 match, safety...

  const upgraded = []
  const downgraded = []

  // baseline 在 reach，模拟后在 match → upgraded
  baseline.reach.forEach(p => {
    if (simResult.match.some(sp => sp._id === p._id)) upgraded.push({ ...p, from: 'reach', to: 'match' })
  })
  // baseline 在 match，模拟后在 safety → upgraded
  // baseline 在 match，模拟后在 reach → downgraded
  // baseline 在 safety，模拟后在 match → downgraded

  return { newPrograms: { reach: newReach, match: newMatch, safety: newSafety }, upgradedPrograms: upgraded, downgradedPrograms: downgraded }
}
```

## 前端模拟器页面变化

### pages/simulator/simulator.js

修改 `data`：

```js
data: {
  baseline: null,         // 从 users.matchResult 加载的 baseline
  simResult: null,        // 模拟结果
  diff: null,             // 对比结果
  newPrograms: { reach: [], match: [], safety: [] },
  upgradedPrograms: [],
  downgradedPrograms: [],
  showResult: false,       // 是否已完成一次模拟
  loading: false,
  // 保留现有滑块/补强 control 部分不变
  state: { gpa: '', toefl: '', gre: '', paper: false, research: false, intern: false, award: false },
  // 保留 TODO/history 部分不变
  ...
}
```

新增方法：

```js
async onLoad() {
  this.loadBaseline()
  // 保留 loadTodos(), loadHistory()
}

async loadBaseline() {
  try {
    const res = await wx.cloud.callFunction({ name: 'getUser' })
    const match = res.result?.matchResult
    if (match) {
      this.setData({ baseline: match })
    }
  } catch (err) {
    console.error('[simulator] load baseline failed', err)
  }

  // 从用户真实档案读取初始值
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

async onSimulate() {
  this.setData({ loading: true, showResult: false })

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
      upgradedPrograms: res.result.upgradedPrograms,
      downgradedPrograms: res.result.downgradedPrograms,
      showResult: true,
      loading: false
    })
  } catch (err) {
    console.error('[simulate] failed', err)
    wx.showToast({ title: '模拟失败，请重试', icon: 'none' })
    this.setData({ loading: false })
  }
}

onReset() {
  this.loadBaseline()
  this.setData({ showResult: false })
}
```

### pages/simulator/simulator.wxml

结果展示区改为展示模拟对比：

```xml
<!-- 学校池变化 -->
<view class="card" wx:if="{{showResult && diff}}">
  <text class="h-md">模拟结果</text>

  <!-- 数量变化卡片 -->
  <view class="sim-diff-grid">
    <view class="sim-diff-item">
      <text>冲刺</text>
      <text>{{diff.reach.baseline}} → {{diff.reach.after}}</text>
      <text class="{{diff.reach.delta > 0 ? 'up' : 'down'}}">{{diff.reach.delta > 0 ? '+' : ''}}{{diff.reach.delta}}</text>
    </view>
    <view class="sim-diff-item">
      <text>匹配</text>
      <text>{{diff.match.baseline}} → {{diff.match.after}}</text>
      <text>{{diff.match.delta > 0 ? '+' : ''}}{{diff.match.delta}}</text>
    </view>
    <view class="sim-diff-item">
      <text>保底</text>
      <text>{{diff.safety.baseline}} → {{diff.safety.after}}</text>
      <text>{{diff.safety.delta > 0 ? '+' : ''}}{{diff.safety.delta}}</text>
    </view>
  </view>

  <text>总新增: +{{diff.totalDelta}} 个项目</text>

  <!-- 新增项目列表 -->
  <view wx:if="{{newPrograms.reach.length > 0}}">
    <text>新增冲刺:</text>
    <text wx:for="{{newPrograms.reach}}" wx:key="_id">{{item.school}}（{{item.fitScore}}分）</text>
  </view>
  <view wx:if="{{newPrograms.match.length > 0}}">
    <text>新增匹配:</text>
    <text wx:for="{{newPrograms.match}}" wx:key="_id">{{item.school}}（{{item.fitScore}}分）</text>
  </view>
  <view wx:if="{{newPrograms.safety.length > 0}}">
    <text>新增保底:</text>
    <text wx:for="{{newPrograms.safety}}" wx:key="_id">{{item.school}}（{{item.fitScore}}分）</text>
  </view>

  <!-- 变化项目 -->
  <view wx:if="{{upgradedPrograms.length > 0}}">
    <text>提升档位:</text>
    <text wx:for="{{upgradedPrograms}}" wx:key="school">{{item.school}}：{{item.from}} → {{item.to}}</text>
  </view>
  <view wx:if="{{downgradedPrograms.length > 0}}">
    <text>下降档位:</text>
    <text wx:for="{{downgradedPrograms}}" wx:key="school">{{item.school}}：{{item.from}} → {{item.to}}</text>
  </view>
</view>
```

保留现有的 TODO / 历史记录 / 顾问引流部分不变。

## 错误处理

### 模拟失败
如果在模拟过程中有网络问题或云函数异常：
- 不展示空的结果卡片，保留最后一次成功的模拟结果（如果有）
- 显示 toast 提示：「模拟失败，请重试」
- 模拟按钮恢复可点击

### baseline 为空
如果用户从未保存过档案（`users.matchResult` 为空）：
- 显示提示：「请先完成个人信息填写，获取基线选校结果后再来模拟」
- 禁用模拟按钮
- 保留 TODO / 历史记录等模块的正常展示

### 模拟参数异常
如果传入的 GPA / TOEFL / GRE 为负数或明显不合理：
- 云函数正常执行，使用 valid 的字段、跳过 invalid
- 前端不做额外校验（GPA 0、TOEFL 0 都是可模拟的值）

## 可选扩展（非 v1 范围）

- 模拟结果的持久化：用户可以保存多次模拟快照，查看历史对比
- 可视化折线图：展示多次模拟的趋势（如 GPA 提升 vs 可选学校数量）
- 建议提升路径：基于用户当前短板，自动生成最优提升方案
- 批量模拟：一次调整多个维度后，系统推荐最高性价比的提升组合
