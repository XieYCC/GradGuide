const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const profileStepDirs = ['profile-step1', 'profile-step2', 'profile-step3', 'profile-step4', 'profile-step5']

profileStepDirs.forEach(dir => {
  const wxssPath = path.join(root, 'pages', dir, `${dir}.wxss`)
  const css = fs.readFileSync(wxssPath, 'utf8')
  assert(css.includes('position: fixed'), `${dir} footer should be fixed to viewport bottom`)
  assert(css.includes('bottom: 0'), `${dir} footer should pin to bottom: 0`)
  assert(css.includes('padding: 24px 16px 96px') || css.includes('padding-bottom'), `${dir} page should reserve bottom padding for fixed footer`)
})

console.log('profile step footer layout test passed')
