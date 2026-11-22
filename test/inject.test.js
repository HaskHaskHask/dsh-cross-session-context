import test from 'node:test'
import assert from 'node:assert/strict'
import { CONTEXT_SOURCE_KIND, buildContextMessage, messageText } from '../lib/inject.js'

test('an injected message is a frozen user message with its own producer kind', () => {
  const message = buildContextMessage('## 跨会话上下文\n- 内容')
  assert.equal(message.role, 'user')
  assert.equal(message.source.kind, CONTEXT_SOURCE_KIND)
  assert.equal(message.source.kind !== 'user', true)
  assert.equal(message.content.length, 1)
  assert.equal(message.content[0].type, 'text')
  assert.equal(Object.isFrozen(message), true)
  assert.equal(Object.isFrozen(message.content), true)
  assert.equal(typeof message.id, 'string')
  assert.equal(message.id.length > 0, true)
})

test('two injected messages never share an id', () => {
  assert.notEqual(buildContextMessage('a').id, buildContextMessage('a').id)
})

test('messageText concatenates text blocks and collapses whitespace', () => {
  assert.equal(messageText({ content: [{ type: 'text', text: ' a\n b ' }, { type: 'image' }] }), 'a b')
  assert.equal(messageText({}), '')
})
