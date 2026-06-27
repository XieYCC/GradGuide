# 微信资料授权与「我的」页改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在引导结束后让用户设置头像昵称，在「我的」页顶部展示微信用户信息

**Architecture:** 云函数扩展 `wxProfile` 字段 + 新增 profile-init 资料设置页 + 改造 mine 页顶部

**Tech Stack:** 原生微信小程序，云函数 SDK，`<button open-type="chooseAvatar">` + `<input type="nickname">`

## Global Constraints

- 微信小程序头像昵称使用开放能力，不调已废弃的 `wx.getUserProfile`
- avatarUrl 只存路径，图片用 `<image>` 展示
- nickName 存字符串，无其他格式限制
- profile-init 页在引导页第 4 屏点「开始使用」后跳转
- 「我的」页顶部使用新采集的 wxProfile，未采集时展示默认占位
- 所有文件路径基于 `D:\Users\XieYC\claude-workspace\GradGuide\miniprogram\`

---

### Task 1: 云函数扩展 - login + getUser 支持 wxProfile

**Files:**
- Modify: `cloudfunctions/login/index.js`
- Modify: `cloudfunctions/getUser/index.js`

**Interfaces:**
- Produces: `getUser` 返回 `{ profile, favorites, simHistory, wxProfile }`
- Produces: `login` 创建用户时带 `wxProfile: {}`

**Step 1: 扩展 login 云函数**

在 `cloudfunctions/login/index.js` 中找到创建新用户的 `db.collection('users').add()` 部分，增加 `wxProfile: {}`：

```javascript
await db.collection('users').add({
  data: {
    _openid: OPENID,
    profile: {},
    favorites: [],
    simHistory: [],
    wxProfile: {},          // ← 新增
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }
})
```

**Step 2: 扩展 getUser 云函数**

在 `cloudfunctions/getUser/index.js` 的 `return` 中增加 `wxProfile`：

```javascript
return {
  profile: user.profile || {},
  favorites: user.favorites || [],
  simHistory: user.simHistory || [],
  wxProfile: user.wxProfile || {}   // ← 新增
}
```

**Step 3: 部署两个云函数**

```bash
cloudbase fn deploy login -e cloud1-d7guh4c7wcad0635c --dir "D:\Users\XieYC\claude-workspace\GradGuide\miniprogram\cloudfunctions\login"
cloudbase fn deploy getUser -e cloud1-d7guh4c7wcad0635c --dir "D:\Users\XieYC\claude-workspace\GradGuide\miniprogram\cloudfunctions\getUser"
```

---

### Task 2: 创建 profile-init 资料设置页

**Files:**
- Create: `pages/profile-init/profile-init.js`
- Create: `pages/profile-init/profile-init.wxml`
- Create: `pages/profile-init/profile-init.wxss`
- Create: `pages/profile-init/profile-init.json`
- Modify: `app.json` 注册页面

**Interfaces:**
- Consumes: `app.globalData.userProfile`（读写）
- Produces: 调用 `saveProfile` 云函数保存 `wxProfile`，然后 `wx.switchTab` 到首页

**Step 1: 注册页面**

在 `app.json` 的 `pages` 数组中增加 `"pages/profile-init/profile-init"`。

**Step 2: profile-init.json**

```json
{
  "navigationStyle": "default",
  "navigationBarTitleText": "设置资料",
  "usingComponents": {}
}
```

**Step 3: profile-init.js**

```javascript
const app = getApp()

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    canSave: false
  },

  onLoad() {
    // 如果是编辑模式（从「我的」页跳来），读取已有数据
    const wxProfile = (app.globalData.userProfile && app.globalData.userProfile.wxProfile) || {}
    this.setData({
      avatarUrl: wxProfile.avatarUrl || '',
      nickName: wxProfile.nickName || ''
    })
  },

  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl })
  },

  onNickNameInput(e) {
    const nickName = e.detail.value
    this.setData({
      nickName,
      canSave: !!nickName
    })
  },

  onSave() {
    if (!this.data.nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    const wxProfile = {
      avatarUrl: this.data.avatarUrl,
      nickName: this.data.nickName
    }

    // 保存到云端
    wx.cloud.callFunction({
      name: 'saveProfile',
      data: { profile: { wxProfile } }
    }).then(() => {
      // 同时更新本地缓存
      app.globalData.userProfile = {
        ...app.globalData.userProfile,
        wxProfile
      }
      // 通知各页面
      const pages = getCurrentPages()
      pages.forEach(p => {
        if (typeof p.onProfileReady === 'function') p.onProfileReady()
      })
      wx.switchTab({ url: '/pages/home/home' })
    }).catch(err => {
      console.error('[profile-init] save failed', err)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    })
  },

  onSkip() {
    wx.switchTab({ url: '/pages/home/home' })
  }
})
```

**Step 4: profile-init.wxml**

```xml
<view class="page-profile-init">
  <view class="avatar-section">
    <button class="avatar-btn" open-type="chooseAvatar" bindchooseavatar="onChooseAvatar">
      <image class="avatar-img" src="{{avatarUrl || '/images/default-avatar.png'}}" mode="aspectFill" />
      <text class="avatar-tip">{{avatarUrl ? '点击更换' : '点击设置头像'}}</text>
    </button>
  </view>

  <view class="nickname-section">
    <text class="field-label">你的昵称</text>
    <input class="nickname-input" type="nickname" value="{{nickName}}" bindinput="onNickNameInput" placeholder="输入你的昵称" />
  </view>

  <view class="actions">
    <button class="save-btn" disabled="{{!canSave}}" bindtap="onSave">保存并开始使用</button>
    <text class="skip-btn" bindtap="onSkip">跳过，暂不设置</text>
  </view>
</view>
```

**Step 5: profile-init.wxss**

```css
.page-profile-init {
  padding: 48px 24px;
  min-height: 100vh;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.avatar-section {
  margin-bottom: 40px;
}
.avatar-btn {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  padding: 0;
  margin: 0;
  background: var(--c-surface, #f5f5f5);
  border: 3px solid var(--c-line, #e4e4e4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.avatar-btn::after {
  border: none;
}
.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}
.avatar-tip {
  position: absolute;
  bottom: -22px;
  font-size: 11px;
  color: var(--c-ink-3, #999);
  white-space: nowrap;
}
.nickname-section {
  width: 100%;
  margin-bottom: 40px;
}
.field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ink-2, #666);
  margin-bottom: 8px;
}
.nickname-input {
  width: 100%;
  padding: 14px 12px;
  border: 1px solid var(--c-line, #e4e4e4);
  border-radius: 10px;
  font-size: 18px;
  box-sizing: border-box;
  text-align: center;
}
.actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.save-btn {
  width: 100%;
  height: 46px;
  line-height: 46px;
  background: var(--c-primary, #2e5d50);
  color: #fff;
  border-radius: 23px;
  font-size: 16px;
  font-weight: 600;
  padding: 0;
  border: 0;
}
.save-btn::after { border: none; }
.save-btn[disabled] {
  opacity: 0.4;
}
.skip-btn {
  font-size: 13px;
  color: var(--c-ink-3, #999);
  padding: 8px;
}
```

**Step 6: 添加默认头像占位图片**

创建一个 100×100 的灰色占位 PNG 到 `images/default-avatar.png`：

```bash
node -e "
const fs = require('fs'), zlib = require('zlib');
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const tb=Buffer.from(t),c=cr32(Buffer.concat([tb,d])),cb=Buffer.alloc(4);cb.writeUInt32BE(c>>>0);return Buffer.concat([l,tb,d,cb])}
function cr32(b){let c=0xffffffff,t=new Int32Array(256);for(let i=0;i<256;i++){let x=i;for(let j=0;j<8;j++)x=(x&1)?0xedb88320^(x>>>1):x>>>1;t[i]=x;}for(let i=0;i<b.length;i++)c=t[(c^b[i])&0xff]^(c>>>8);return(c^0xffffffff)>>>0}
function png(r,g,b,w,h){const s=Buffer.from([137,80,78,71,13,10,26,10]),ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;const raw=[];for(let y=0;y<h;y++){raw.push(0);for(let x=0;x<w;x++)raw.push(r,g,b)}return Buffer.concat([s,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(Buffer.from(raw))),chunk('IEND',Buffer.alloc(0))])}
fs.writeFileSync('D:/Users/XieYC/claude-workspace/GradGuide/miniprogram/images/default-avatar.png', png(200,200,200,100,100));
"
```

---

### Task 3: 修改引导页第4屏「开始使用」跳转到 profile-init

**Files:**
- Modify: `pages/onboarding/onboarding.js`

**Interfaces:**
- Consumes: 无
- Produces: 跳转到 `profile-init` 页

**Step 1: 修改跳转目标**

在 `pages/onboarding/onboarding.js` 中，`onStart` 方法改为：

```javascript
onStart() {
  wx.setStorageSync('hasOnboarded', true)
  app.globalData.hasOnboarded = true
  wx.navigateTo({ url: '/pages/profile-init/profile-init' })
},
```

`onSkip` 方法保留直接跳首页：

```javascript
onSkip() {
  wx.setStorageSync('hasOnboarded', true)
  app.globalData.hasOnboarded = true
  wx.switchTab({ url: '/pages/home/home' })
}
```

---

### Task 4: 改造「我的」页顶部展示 wxProfile

**Files:**
- Modify: `pages/mine/mine.js`
- Modify: `pages/mine/mine.wxml`
- Modify: `pages/mine/mine.wxss`

**Interfaces:**
- Consumes: `app.globalData.userProfile.wxProfile`
- Produces: 展示头像+昵称+编辑入口

**Step 1: mine.js 增加 wxProfile 读取**

在 `syncData` 中增加 `wxProfile`：

```javascript
syncData() {
  const profile = app.globalData.userProfile || {}
  const wxProfile = profile.wxProfile || {}
  const hasProfile = !!(profile.school || profile.gpa)
  this.setData({
    isLoggedIn: app.globalData.isLoggedIn,
    profile,
    hasProfile,
    wxProfile
  })
},
```

data 中增加 `wxProfile` 初始值：

```javascript
data: {
  isLoggedIn: false,
  profile: {},
  hasProfile: false,
  wxProfile: {}
},
```

**Step 2: mine.wxml 顶部改为微信资料卡片**

```xml
<!-- 用户卡片 -->
<view class="mine-user card">
  <view class="mine-avatar-wrap">
    <image class="mine-avatar-img" src="{{wxProfile.avatarUrl || '/images/default-avatar.png'}}" mode="aspectFill" wx:if="{{wxProfile.nickName}}" />
    <view class="mine-avatar-default" wx:else>
      <text class="mine-avatar-text">{{(wxProfile.nickName || '?')[0]}}</text>
    </view>
  </view>
  <view class="mine-user-info">
    <text class="mine-user-name">{{wxProfile.nickName || '留学申请者'}}</text>
    <text class="mine-user-status">微信用户</text>
  </view>
  <text class="mine-edit-btn" bindtap="goToProfileInit">编辑资料</text>
</view>
```

**Step 3: mine.js 增加 goToProfileInit**

```javascript
goToProfileInit() {
  wx.navigateTo({ url: '/pages/profile-init/profile-init' })
},
```

**Step 4: mine.wxss 头像样式**

```css
.mine-user {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  margin-bottom: 16px;
}
.mine-avatar-wrap {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  overflow: hidden;
  flex-shrink: 0;
}
.mine-avatar-img {
  width: 100%;
  height: 100%;
}
.mine-avatar-default {
  width: 100%;
  height: 100%;
  background: var(--c-primary, #2e5d50);
  display: flex;
  align-items: center;
  justify-content: center;
}
.mine-avatar-text {
  font-size: 24px;
  color: #fff;
  font-weight: 600;
}
.mine-user-info {
  flex: 1;
}
.mine-user-name {
  font-size: 18px;
  font-weight: 600;
  display: block;
}
.mine-user-status {
  font-size: 12px;
  color: var(--c-ink-3, #999);
  display: block;
  margin-top: 2px;
}
.mine-edit-btn {
  font-size: 12px;
  color: var(--c-primary, #2e5d50);
  padding: 6px 12px;
  border: 1px solid var(--c-primary, #2e5d50);
  border-radius: 14px;
}
```

**Step 5: 清理 mine.wxml 中旧的用户卡片代码**

确保新的卡片替换了原来用 profile.school[0] 做头像和昵称的那段代码。

---

### Task 5: 部署 + 集成测试

**Files:**
- 无代码变更，部署并验证

**Step 1: 部署云函数**

```bash
cloudbase fn deploy login -e cloud1-d7guh4c7wcad0635c --dir "D:\Users\XieYC\claude-workspace\GradGuide\miniprogram\cloudfunctions\login"
cloudbase fn deploy getUser -e cloud1-d7guh4c7wcad0635c --dir "D:\Users\XieYC\claude-workspace\GradGuide\miniprogram\cloudfunctions\getUser"
```

**Step 2: 全流程验证**

A. **首次用户流程：**
1. 清缓存 → 打开 → 引导页 4 屏
2. 点「开始使用」→ 跳转到 profile-init 页
3. 选择头像、输入昵称 → 保存并开始使用 → 进入首页
4. 切「我的」tab → 顶部显示头像和昵称

B. **跳过流程：**
1. 清缓存 → 引导页 → 点「跳过」→ 直接进首页
2. 切「我的」→ 显示默认头像 + "留学申请者"

C. **编辑流程：**
1. 「我的」→ 点「编辑资料」→ 跳到 profile-init 页
2. 可修改头像/昵称 → 保存 → 跳回首页
3. 再切「我的」→ 更新后的头像昵称展示

D. **老用户兼容：**
1. 已有 users 记录中没有 wxProfile 字段 → getUser 返回 `wxProfile: {}`
2. 「我的」页应正常展示默认头像 + "留学申请者"
