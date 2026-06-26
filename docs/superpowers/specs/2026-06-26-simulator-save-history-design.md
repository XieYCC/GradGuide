# 模拟器保存与历史记录设计

## 保存交互流程

```text
用户完成模拟 → 点击「保存本次模拟结果」
  ↓
弹出自定义命名弹窗（覆盖层，不跳转页面）
  ↓
用户输入名称（默认值: "模拟结果 2026-06-26"）→ 点击「确认」
  ↓
调 saveSimResult 云函数 → 写入 users.simHistory
  ↓
toast 提示「保存成功」→ 弹窗关闭 → 刷新历史记录列表
用户点击「取消」→ 弹窗关闭，不做任何操作
```

## 云函数修改

### saveSimResult

现有结构是：

```js
record = {
  timestamp: "...",
  state: {...},
  score: 73,
  tier: { reach: 5, match: 10, safe: 6 },
  unlocked: [...]
}
```

修改为：

```js
record = {
  name: "模拟结果 2026-06-26",    // 新增：用户输入的名称
  timestamp: "...",
  score: 73,
  diff: { ... },                    // 模拟后的 diff
  newPrograms: { reach: [], match: [], safety: [] }, // 新增项目
  upgradedPrograms: [],             // 提升项目
  downgradedPrograms: [],           // 下降项目
  simResult: {                      // 完整选校结果
    reach: [{ school, fitScore, reasons, risks, ... }],
    match: [...],
    safety: [...]
  }
}
```

`state`, `tier`, `unlocked` 可以从入参中移除，因为这些信息已经包含在 `simResult` 和 `diff` 中。

## 前端弹窗设计

在当前模拟器页面的 WXML 末尾添加：

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

JS 新增：

```js
data: {
  showSaveModal: false,
  saveName: '',
  ...
},

onSaveResult() {
  const defaultName = `模拟结果 ${new Date().toISOString().slice(0, 10)}`
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
  if (!this.data.simResult) {
    wx.showToast({ title: '请先进行一次模拟', icon: 'none' })
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

## 历史记录交互修改

当前 WXML 历史记录列表每项：

```xml
<view class="sim-history-item" wx:for="{{history}}" wx:for-index="idx" wx:key="index">
  <view class="sim-history-meta">
    <text class="sim-history-time">{{item.timestamp}}</text>
    <view class="sim-history-score-row">
      <text class="sim-history-score">评分: {{item.score}}</text>
      <text class="sim-history-tier">冲刺 {{item.tier.reach}} / 匹配 {{item.tier.match}} / 保底 {{item.tier.safe}}</text>
    </view>
  </view>
  <view class="sim-history-actions">
    <text class="sim-history-load" data-index="{{idx}}" bindtap="onLoadHistory">查看</text>
    <text class="sim-history-del" data-timestamp="{{item.timestamp}}" bindtap="onDeleteHistory">删除</text>
  </view>
</view>
```

点「查看」跳转到新页面：

```js
onLoadHistory(e) {
  const idx = e.currentTarget.dataset.index
  const record = this.data.history[idx]
  if (!record) return
  wx.navigateTo({
    url: `/pages/sim-history-detail/sim-history-detail?data=${encodeURIComponent(JSON.stringify(record))}`
  })
}
```

## 新页面：sim-history-detail

### wxml

和 `pages/match/match.wxml` 结构一样的三档展示，只是数据源不是 `matchResult` 而是传入的 `record.simResult`：

```xml
<view class="page-history-detail">
  <view class="history-detail-header">
    <text class="history-detail-name">{{detail.name}}</text>
    <text class="history-detail-time">{{detail.timestamp}}</text>
    <text class="history-detail-score">综合评分: {{detail.score}}</text>
  </view>

  <!-- 冲刺 -->
  <view class="tier-section" wx:if="{{detail.simResult.reach.length > 0}}">
    <view class="tier-header">
      <text class="tier-title">冲刺（{{detail.simResult.reach.length}}）</text>
    </view>
    <view class="tier-grid">
      <view class="program-card card" wx:for="{{detail.simResult.reach}}" wx:key="_id">
        <!-- 和选校页一样的卡片结构 -->
      </view>
    </view>
  </view>

  <!-- 匹配 / 保底 同理 -->
</view>
```

### js

```js
Page({
  data: {
    detail: null
  },

  onLoad(options) {
    if (options.data) {
      const detail = JSON.parse(decodeURIComponent(options.data))
      this.setData({ detail })
    }
  }
})
```

## 间距调整

在 wxss 中给 `sim-score-card` 添加 `margin-bottom`：

```css
.sim-score-card {
  padding: 24px;
  margin-bottom: 16px;
}
```

确保「保存本次模拟结果」区域和下方的 TODO 报告之间有足够间距。

## 数据流

```text
点击「保存本次模拟结果」
  → 弹窗输入名称
  → confirmSave()
    → wx.cloud.callFunction('saveSimResult', { name, diff, newPrograms, simResult, score })
    → 云函数将完整记录 push 到 users.simHistory
    → 成功 → toast + 关闭弹窗 + loadHistory()
  → loadHistory()
    → getSimHistory 返回 simHistory 数组
    → 列表显示名称 + timestamp + 评分

点击历史记录列表中的某条「查看」
  → wx.navigateTo('sim-history-detail', { data: record })
  → 新页面展示三档选校列表（和 match 页一致）
```

## 错误处理

- 未进行模拟就点保存 → toast「请先进行一次模拟」
- 名称为空 → toast「请输入名称」
- 云函数失败 → toast「保存失败」
- 外部存储的 `simResult` 数据不完整 → 详情页兜底显示「数据异常」
