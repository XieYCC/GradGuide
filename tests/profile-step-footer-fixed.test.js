const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
// profile 五步已收进 pages/profile/ 子文件夹，文件名带语义后缀
const profileStepDirs = ['step1-school', 'step2-grad', 'step3-scores', 'step4-experience', 'step5-targets']

// footer 外壳已抽到 styles/profile-step.wxss，各页通过 @import 引入。
// 收集页面自身样式 + 共享外壳样式，作为该页生效样式一起断言。
const sharedPath = path.join(root, 'styles', 'profile-step.wxss')
const sharedCss = fs.existsSync(sharedPath) ? fs.readFileSync(sharedPath, 'utf8') : ''

profileStepDirs.forEach(dir => {
  const wxssPath = path.join(root, 'pages', 'profile', dir, `${dir}.wxss`)
  const css = fs.readFileSync(wxssPath, 'utf8') + '\n' + sharedCss
  assert(css.includes('position: fixed'), `${dir} footer should be fixed to viewport bottom`)
  assert(css.includes('bottom: 0'), `${dir} footer should pin to bottom: 0`)
  assert(css.includes('padding: 24px 16px 96px') || css.includes('padding-bottom') || css.includes('env(safe-area-inset-bottom)'), `${dir} page should reserve bottom padding for fixed footer`)
})

console.log('profile step footer layout test passed')
