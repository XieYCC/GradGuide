const assert = require('assert')

// Simulate onGpaInput behavior
function onGpaInput(detailValue) {
  // OLD: breaks decimal input
  // return parseFloat(detailValue) || 0

  // NEW: keep raw string
  return detailValue
}

assert.strictEqual(onGpaInput('3.'), '3.', 'should keep trailing dot')
assert.strictEqual(onGpaInput('3.65'), '3.65', 'should keep full decimal')
assert.strictEqual(onGpaInput(''), '', 'should keep empty string')
assert.strictEqual(onGpaInput('3'), '3', 'should keep integer')

console.log('GPA input preserves decimal points')
