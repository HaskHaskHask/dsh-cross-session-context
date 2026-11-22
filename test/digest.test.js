import test from 'node:test'
import assert from 'node:assert/strict'
import { DIGEST_HEADER, renderDigest } from '../lib/digest.js'

const entry = (id, text) => ({
  id,
  label: `会话 ${id}`,
  createdAt: Date.UTC(2026, 10, 21),
  messages: [{ role: 'user', text }],
  omitted: 0,
})

test('a digest carries the untrusted-data warning and the rendered sections', () => {
  const result = renderDigest([entry('aaaa1111', '关于压缩阈值的讨论')], { totalChars: 4000 })
  assert.equal(result.text.startsWith(DIGEST_HEADER), true)
  assert.equal(result.text.includes('安全规则'), true)
  assert.equal(result.text.includes('2026-11-21'), true)
  assert.equal(result.text.includes('aaaa1111'), true)
  assert.equal(result.text.includes('关于压缩阈值的讨论'), true)
  assert.deepEqual(result.included, ['aaaa1111'])
  assert.equal(result.dropped, 0)
})

test('later entries are dropped once the budget is spent, and that is stated', () => {
  const entries = [entry('aaaa1111', 'x'.repeat(300)), entry('bbbb2222', 'y'.repeat(3000))]
  const result = renderDigest(entries, { totalChars: 900 })
  assert.deepEqual(result.included, ['aaaa1111'])
  assert.equal(result.dropped, 1)
  assert.equal(result.text.includes('另有 1 个相关会话'), true)
})

test('the first entry is truncated rather than dropped when it alone overflows', () => {
  const result = renderDigest([entry('aaaa1111', 'z'.repeat(5000))], { totalChars: 700 })
  assert.equal(result.included.length, 1)
  assert.equal(result.text.length <= 700, true)
  assert.equal(result.text.endsWith('…'), true)
})

test('an empty entry list still returns the framed header', () => {
  const result = renderDigest([], { totalChars: 1000 })
  assert.equal(result.text, DIGEST_HEADER)
  assert.deepEqual(result.included, [])
})

test('omitted earlier messages are reported per section', () => {
  const withOmission = { ...entry('cccc3333', 'last message'), omitted: 7 }
  const result = renderDigest([withOmission], { totalChars: 4000 })
  assert.equal(result.text.includes('更早的 7 条消息已省略'), true)
})

test('the section shows the uuid head of a session-prefixed id', () => {
  const prefixed = { ...entry('session-9f3a2b1c-rest', '正文'), label: '标题' }
  const result = renderDigest([prefixed], { totalChars: 4000 })
  assert.equal(result.text.includes('### 1. 标题 · 9f3a2b1c ·'), true)
})
