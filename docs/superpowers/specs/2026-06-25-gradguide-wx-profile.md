# GradGuide 微信资料授权与「我的」页改造方案

## 概述

为 GradGuide 小程序接入微信用户资料（头像、昵称），在引导流程结束后提示用户设置微信资料，在「我的」页面顶部展示用户信息。

## 当前现状

- 已有云开发 `login`/`getUser`/`saveProfile` 云函数
- `users` 集合记录 `_openid`、`profile`、`favorites`、`simHistory`
- 尚无头像、昵称字段
- 「我的」页顶部用 `profile.school[0]` 或占位字符做头像，`profile.school || '留学申请者'` 做昵称
- 微信小程序当前推荐使用 `<button open-type="chooseAvatar">` + `<input type="nickname">` 获取头像昵称，无需传统授权弹窗

## 设计方案

### 数据库字段扩展

`users` 集合每条记录增加字段：

```json
{
  "wxProfile": {
    "avatarUrl": "https://wx.qlogo.cn/mmopen/...",
    "nickName": "张三"
  }
}
```

- `login` 云函数：创建新用户时，写入空 `wxProfile: {}`
- `getUser` 云函数：返回数据增加 `wxProfile` 字段

### 新增资料设置页 (pages/profile-init)

#### 触发时机
引导页第 4 屏，用户点击「开始使用」后：

```
引导页第4屏「开始使用」
  ↓
wx.setStorageSync('hasOnboarded', true)
  ↓
跳转到 profile-init 页（非 tab 页）
  ↓
设置头像/昵称后
  ↓
保存到 users.wxProfile
  ↓
wx.switchTab 进入首页
```

#### 页面结构

```
┌─────────────────────┐
│                     │
│    [圆形头像]        │  ← 默认灰色占位，可点击选择头像
│                     │
│    点击设置头像      │
│                     │
│  ┌───────────────┐  │
│  │ 输入你的昵称    │  │  ← <input type="nickname">
│  └───────────────┘  │
│                     │
│  [保存并开始使用]    │  ← 必填昵称才能点击
│                     │
│  [跳过，暂不设置]   │  ← 可选跳过
│                     │
└─────────────────────┘
```

#### 交互逻辑

- 点击头像区域 → `<button open-type="chooseAvatar">` 触发系统头像选择
- 选择后预览展示
- 昵称使用 `<input type="nickname">`，微信自动弹出昵称填写建议
- 昵称为必填项，头像可选
- 保存 → 调用 `saveProfile` 云函数（或新增 `saveWxProfile` 云函数）写入 `wxProfile`
- 跳过 → 不保存，直接进入首页

### 「我的」页顶部改造

当前代码 `pages/mine/mine.wxml` 的用户卡片改为：

```
┌──────────────────────────┐
│  [圆形头像（微信头像）]    │
│  昵称（或"留学申请者"）   │
│  微信用户                 │
│                          │
│  [编辑资料]               │  ← 跳转到 profile-init 页
└──────────────────────────┘
```

- 有 `wxProfile.avatarUrl` → 用 `<image>` 展示微信头像
- 无 → 用占位灰色头像 + 初始字母
- 有 `wxProfile.nickName` → 展示昵称
- 无 → 展示"留学申请者"
- 底部增加「编辑资料」按钮，跳到 `profile-init` 页（带参数 `edit=1`）

### 数据流

```
前端引导页"开始使用" → profile-init 页
  ↓
用户选择头像、输入昵称
  ↓
wx.cloud.callFunction({ name: 'saveProfile', data: { wxProfile: { avatarUrl, nickName } } })
  ↓
app.globalData.userProfile.wxProfile 写入缓存
  ↓
wx.switchTab 进入首页

「我的」页 onShow
  ↓
refreshFromCloud → getUser 云函数
  ↓
getUser 返回含 wxProfile
  ↓
mine 页 setData 展示
```

### 受影响的文件

| 文件 | 改动 |
|------|------|
| `cloudfunctions/login/index.js` | 创建用户时增加空 `wxProfile: {}` |
| `cloudfunctions/getUser/index.js` | 返回数据增加 `wxProfile` |
| `pages/profile-init/` (新增) | 资料设置页 4 文件 |
| `pages/mine/mine.wxml` | 顶部改为微信头像+昵称展示，加「编辑资料」按钮 |
| `pages/mine/mine.js` | syncData 读取展示 `wxProfile` |
| `pages/mine/mine.wxss` | 头像样式 |
| `app.json` | 注册 `pages/profile-init/profile-init` 页 |

### 未涵盖的范围

- 手机号授权（后续扩展）
- 简历自动生成（后续扩展）
