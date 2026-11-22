import test from 'node:test'
import assert from 'node:assert/strict'
import { FUSE_USAGE, fuseChangeText, fuseStatusText, parseFuseArgs } from '../lib/control.js'

test('the bare command and "status" both ask for the current state', () => {
  assert.equal(parseFuseArgs(''), 'status')
  assert.equal(parseFuseArgs('   '), 'status')
  assert.equal(parseFuseArgs(' status '), 'status')
})

test('on and off accept their synonyms, case-insensitively', () => {
  assert.equal(parseFuseArgs('on'), 'on')
  assert.equal(parseFuseArgs(' ENABLE '), 'on')
  assert.equal(parseFuseArgs('allow'), 'on')
  assert.equal(parseFuseArgs('off'), 'off')
  assert.equal(parseFuseArgs('Disable'), 'off')
  assert.equal(parseFuseArgs('deny'), 'off')
})

test('anything else is unusable', () => {
  assert.equal(parseFuseArgs('maybe'), null)
  assert.equal(parseFuseArgs('on now'), null)
  assert.equal(parseFuseArgs(undefined), 'status')
  assert.equal(parseFuseArgs(42), 'status')
})

test('status and change text distinguish the two permissions', () => {
  assert.equal(fuseStatusText(true).includes('允许'), true)
  assert.equal(fuseStatusText(false).includes('已拒绝'), true)
  assert.equal(fuseChangeText(true).includes('已允许'), true)
  assert.equal(fuseChangeText(false).includes('已拒绝'), true)
  assert.equal(FUSE_USAGE.includes('/fuse'), true)
})
