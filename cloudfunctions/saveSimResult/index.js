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
