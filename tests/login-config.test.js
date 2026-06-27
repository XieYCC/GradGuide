const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
}

function readText(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

const projectConfig = readJson('project.config.json')
const claudeMd = readText('.claude/CLAUDE.md')

const appidMatch = claudeMd.match(/appid:\s*`?([a-z0-9]+)`?/i)
assert(appidMatch, 'CLAUDE.md should document the expected WeChat appid')

const expectedAppid = appidMatch[1]
// 使用项目实际配置的 AppID（可能文档已过时）
const actualAppid = projectConfig.appid

console.log(`文档中记录的 AppID: ${expectedAppid}`)
console.log(`项目实际配置的 AppID: ${actualAppid}`)

// 注意：如果项目实际使用的 AppID 与文档不一致，可能导致云函数登录失败
// 这是常见的 "登录失效" 问题原因之一
assert.strictEqual(
  actualAppid,
  expectedAppid,
  `project.config.json appid (${actualAppid}) 与文档中的 cloud-enabled appid (${expectedAppid}) 不一致。\n这可能导致云函数无法正确获取用户 openid，从而引发登录失效问题。\n请确认项目实际使用的 AppID 是否正确，或者更新文档中的 AppID。`
)

console.log('login cloud appid config is consistent')
