import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, createConfigSchema, resolveConfig } from '../lib/config.js'
import { selectCandidates, uniqueIds } from '../lib/scan.js'

test('an absent config resolves to the defaults', () => {
  assert.deepEqual(resolveConfig(undefined), DEFAULTS)
  assert.deepEqual(resolveConfig(null), DEFAULTS)
})

test('provided values override only their own field', () => {
  const config = resolveConfig({ auto: false, scanLimit: 3 })
  assert.equal(config.auto, false)
  assert.equal(config.scanLimit, 3)
  assert.equal(config.maxSessions, DEFAULTS.maxSessions)
})

test('unknown settings and out-of-range values are rejected by name', () => {
  assert.throws(() => resolveConfig({ nope: 1 }), /unknown config setting "nope"/)
  assert.throws(() => resolveConfig({ scanLimit: 0 }), /"scanLimit" must be an integer between 1 and 20/)
  assert.throws(() => resolveConfig({ autoMinScore: 2 }), /"autoMinScore" must be a number between 0 and 1/)
  assert.throws(() => resolveConfig({ auto: 'yes' }), /"auto" must be a boolean/)
  assert.throws(() => resolveConfig({ maxSessions: 3, totalChars: 900, charsPerSession: 3000 }), /totalChars/)
})

test('the schema validates through its Standard Schema face', () => {
  const schema = createConfigSchema()
  assert.equal(schema['~standard'].validate({ scanLimit: 2 }).value.scanLimit, 2)
  assert.equal(Array.isArray(schema['~standard'].validate({ scanLimit: 99 }).issues), true)
})

test('candidates exclude self, parent, subagents and other working directories', () => {
  const records = [
    { header: { id: 'self', createdAt: 5, cwd: 'E:/w' } },
    { header: { id: 'parent', createdAt: 4, cwd: 'E:/w' } },
    { header: { id: 'child', createdAt: 3, cwd: 'E:/w', origin: 'subagent' } },
    { header: { id: 'other-cwd', createdAt: 2, cwd: 'E:/elsewhere' } },
    { header: { id: 'good-old', createdAt: 1, cwd: 'E:/w' } },
  ]
  const selected = selectCandidates(records, {
    selfId: 'self',
    parentId: 'parent',
    cwd: 'E:/w',
    includeSubagents: false,
    excludeParentSession: true,
  })
  assert.deepEqual(selected.map(item => item.id), ['good-old'])
})

test('subagents and the parent are kept when the options allow them', () => {
  const records = [
    { header: { id: 'parent', createdAt: 4, cwd: 'E:/w' } },
    { header: { id: 'child', createdAt: 3, cwd: 'E:/w', origin: 'subagent' } },
  ]
  const selected = selectCandidates(records, {
    selfId: 'self',
    parentId: 'parent',
    cwd: 'E:/w',
    includeSubagents: true,
    excludeParentSession: false,
  })
  assert.deepEqual(selected.map(item => item.id), ['parent', 'child'])
})

test('candidates are ordered newest first and malformed records are ignored', () => {
  const records = [
    { header: { id: 'older', createdAt: 1, cwd: 'E:/w' } },
    null,
    { header: {} },
    { header: { id: 'newer', createdAt: 9, cwd: 'E:/w' } },
  ]
  const selected = selectCandidates(records, {
    selfId: 'self',
    cwd: 'E:/w',
    includeSubagents: true,
    excludeParentSession: true,
  })
  assert.deepEqual(selected.map(item => item.id), ['newer', 'older'])
})

test('uniqueIds trims, drops empties and keeps the first occurrence', () => {
  assert.deepEqual(uniqueIds([' a ', 'b', 'a', '', 42, 'b']), ['a', 'b'])
})
