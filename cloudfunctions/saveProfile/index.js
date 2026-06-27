// 云函数：saveProfile - 保存档案，支持部分更新
// 前端传什么字段就更新什么字段，不影响其他字段
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { runMatch, getSelectivityBand } = require('./match-logic')

async function triggerMatch(OPENID, profile) {
  try {
    const progRes = await db.collection('programs').where({ enabled: true }).limit(1000).get()
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

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { profile } = event

  if (!profile) {
    return { code: -1, message: 'profile 不能为空' }
  }

  const userRes = await db.collection('users').where({
    _openid: OPENID
  }).get()

  const incomingProfile = { ...profile }
  const incomingWxProfile = incomingProfile.wxProfile
  delete incomingProfile.wxProfile

  if (userRes.data.length === 0) {
    const data = {
      _openid: OPENID,
      profile: incomingProfile,
      wxProfile: incomingWxProfile || {},
      favorites: [],
      simHistory: [],
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
    const addRes = await db.collection('users').add({ data })
    await triggerMatch(OPENID, incomingProfile)
    return { code: 0, message: '创建并保存成功', created: true, id: addRes._id }
  }

  const user = userRes.data[0]
  const mergedProfile = {
    ...(user.profile || {}),
    ...incomingProfile
  }

  const updateData = {
    profile: mergedProfile,
    updatedAt: db.serverDate()
  }

  if (incomingWxProfile) {
    updateData.wxProfile = {
      ...(user.wxProfile || {}),
      ...incomingWxProfile
    }
  }

  const res = await db.collection('users').where({
    _openid: OPENID
  }).update({
    data: updateData
  })

  await triggerMatch(OPENID, mergedProfile)

  return { code: 0, message: '保存成功', updated: res.stats.updated }
}
