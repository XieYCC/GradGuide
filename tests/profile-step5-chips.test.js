const assert = require('assert')
const fs = require('fs')
const path = require('path')

const wxml = fs.readFileSync(path.resolve('D:/Users/XieYC/claude-workspace/GradGuide/miniprogram/pages/profile-step5/profile-step5.wxml'), 'utf8')
const js = fs.readFileSync(path.resolve('D:/Users/XieYC/claude-workspace/GradGuide/miniprogram/pages/profile-step5/profile-step5.js'), 'utf8')

// Check bindtap exists
assert(wxml.includes('bindtap="toggleItem"'), 'toggleItem should be bound in wxml')
assert(wxml.includes('data-type'), 'data-type attribute should exist')
assert(wxml.includes('data-index'), 'data-index attribute should exist')

// Check toggleItem reads dataset
assert(js.includes('e.currentTarget.dataset'), 'toggleItem should read dataset')
assert(js.includes('type'), 'toggleItem should read type from dataset')
assert(js.includes('index'), 'toggleItem should read index from dataset')

console.log('PASS: profile-step5 event binding uses data-index')
