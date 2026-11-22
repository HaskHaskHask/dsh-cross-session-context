import test from 'node:test'
import assert from 'node:assert/strict'
import { blockText, extractConversation, sessionLabel, truncateText } from '../lib/extract.js'

const user = (text, kind = 'user') => ({
  type: 'user/message',
  data: { source: { kind }, content: [{ type: 'text', text }] },
})
const assistant = (text) => ({
  type: 'assistant/message',
  data: { source: { kind: 'model' }, content: [{ type: 'text', text }] },
})

test('blockText joins text blocks and collapses whitespace', () => {
  assert.equal(blockText([{ type: 'text', text: ' a\n\n b ' }, { type: 'image' }]), 'a b')
  assert.equal(blockText(undefined), '')
})

test('truncateText ellipsizes only when needed', () => {
  assert.equal(truncateText('abcd', 4), 'abcd')
  assert.equal(truncateText('abcde', 4), 'abc…')
})

test('extractConversation keeps user and assistant text only', () => {
  const snapshot = {
    events: [
      { type: 'system/message', data: { content: [{ type: 'text', text: 'prompt' }] } },
      user('第一问'),
      user('系统注入的运行时上下文', 'context'),
      assistant('回答一'),
      { type: 'tool/result', data: { content: [{ type: 'text', text: 'tool output' }] } },
    ],
  }
  const result = extractConversation(snapshot, { keepMessages: 12, perMessageChars: 500 })
  assert.deepEqual(result.messages, [
    { role: 'user', text: '第一问' },
    { role: 'assistant', text: '回答一' },
  ])
  assert.equal(result.firstUser, '第一问')
  assert.equal(result.omitted, 0)
})

test('the retained window keeps the tail and reports the omitted count', () => {
  const events = []
  for (let index = 0; index < 5; index += 1) {
    events.push(user(`u${index}`), assistant(`a${index}`))
  }
  const result = extractConversation({ events }, { keepMessages: 4, perMessageChars: 500 })
  assert.deepEqual(result.messages.map(message => message.text), ['u3', 'a3', 'u4', 'a4'])
  assert.equal(result.omitted, 6)
})

test('per-message budget truncates each retained message', () => {
  const long = 'x'.repeat(200)
  const result = extractConversation({ events: [user(long)] }, { keepMessages: 12, perMessageChars: 20 })
  assert.equal(result.messages[0].text.length, 20)
  assert.equal(result.messages[0].text.endsWith('…'), true)
})

test('searchText covers more history than the rendered window', () => {
  const events = [user('alpha keyword'), assistant('beta')]
  for (let index = 0; index < 20; index += 1) events.push(user(`filler ${index}`))
  const result = extractConversation({ events }, { keepMessages: 2, perMessageChars: 500 })
  assert.equal(result.messages.length, 2)
  assert.equal(result.searchText.includes('alpha keyword'), true)
})

test('a surface with no eligible text yields an empty window', () => {
  const result = extractConversation({ events: [user('injected', 'context')] }, { keepMessages: 5, perMessageChars: 100 })
  assert.deepEqual(result.messages, [])
  assert.equal(result.firstUser, '')
})

test('an earlier fusion digest is not re-fused as human text', () => {
  const events = [
    user('真正的人类提问'),
    user('## 跨会话上下文（历史会话，非当前对话）…', 'cross-session-context'),
  ]
  const result = extractConversation({ events }, { keepMessages: 5, perMessageChars: 100 })
  assert.deepEqual(result.messages.map(message => message.text), ['真正的人类提问'])
})

test('sessionLabel falls back from title to first message to id', () => {
  assert.equal(sessionLabel('  Some  title ', 'first', 'abcdefgh'), 'Some title')
  assert.equal(sessionLabel(undefined, 'first user words here', 'abcdefgh'), 'first user words here')
  assert.equal(sessionLabel(undefined, '', 'abcdefgh'), 'abcdefgh')
})
