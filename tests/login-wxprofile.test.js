const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const appCode = fs.readFileSync(path.join(root, 'app.js'), 'utf8')

let capturedApp = null

const sandbox = {
  console,
  getCurrentPages() {
    return []
  },
  App(config) {
    capturedApp = config
  },
  wx: {
    getStorageSync() {
      return true
    },
    cloud: {
      init() {},
      async callFunction(options) {
        if (options.name === 'login') {
          return { result: { isNewUser: false, openid: 'openid-test' } }
        }
        if (options.name === 'getUser') {
          return {
            result: {
              profile: { school: '武汉大学' },
              wxProfile: {
                avatarUrl: 'cloud://avatar-url',
                nickName: '测试昵称'
              },
              favorites: [],
              simHistory: []
            }
          }
        }
        throw new Error(`unexpected cloud function: ${options.name}`)
      }
    }
  }
}

vm.runInNewContext(appCode, sandbox, { filename: 'app.js' })

assert(capturedApp, 'app.js should call App(config)')

capturedApp.loginAndLoad().then(() => {
  assert.strictEqual(capturedApp.globalData.isLoggedIn, true)
  assert.deepStrictEqual(capturedApp.globalData.userProfile.wxProfile, {
    avatarUrl: 'cloud://avatar-url',
    nickName: '测试昵称'
  })
  console.log('loginAndLoad preserves wxProfile')
}).catch(err => {
  console.error(err)
  process.exit(1)
})
