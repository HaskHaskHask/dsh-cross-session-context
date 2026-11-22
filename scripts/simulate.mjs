// Offline self-check: drive apply() with fake host services so the whole fusion
// pipeline runs without a live Harness session. Exits non-zero when the tool,
// the automatic pre-step path, or the `/fuse` permission gate stops working.
//
//   node scripts/simulate.mjs
import { apply } from '../index.js'

const surfaces = {
  'session-alpha': {
    session: { id: 'session-alpha', createdAt: Date.UTC(2026, 10, 20) },
    events: [
      { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '我们在讨论跨对话融合上下文的插件设计' }] } },
      { type: 'assistant/message', data: { source: { kind: 'model' }, content: [{ type: 'text', text: '需要读取同工作区的其他会话，并做预算控制。' }] } },
    ],
  },
  'session-beta': {
    session: { id: 'session-beta', createdAt: Date.UTC(2026, 10, 19) },
    events: [
      { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '帮我打包发布桌面安装包' }] } },
    ],
  },
}

const records = [
  { header: { id: 'session-alpha', createdAt: surfaces['session-alpha'].session.createdAt, cwd: 'E:/w' } },
  { header: { id: 'session-beta', createdAt: surfaces['session-beta'].session.createdAt, cwd: 'E:/w' } },
]

let tool
let command
let preStep
const ctx = {
  sessionQuery: {
    filterSessions: async () => records,
    readSurface: async id => surfaces[id],
  },
  tools: { register: (definition) => { tool = definition; return () => {} } },
  commands: { register: (definition) => { command = definition; return () => {} } },
  effect: fn => fn(),
  on: (name, listener) => { if (name === 'agent/pre-step') preStep = listener },
}

apply(ctx, {})
if (tool?.name !== 'fuse_session_context') throw new Error('tool was not registered')
if (command?.name !== 'fuse') throw new Error('/fuse command was not registered')

let restricted = 0
let lifted = 0
const agent = {
  session: { header: { id: 'session-me', cwd: 'E:/w' } },
  ctx: { tools: { restrict: () => { restricted += 1; return () => { lifted += 1 } } } },
}
const runCommand = (rawInput) => command.handler({ agent, rawInput, signal: new AbortController().signal })

const result = await tool.execute({ query: '跨对话融合上下文的插件' }, { agent, signal: new AbortController().signal })
if (result.sessions.length !== 1 || result.sessions[0].score !== 1) throw new Error('unexpected tool result')
if (!result.text.includes('安全规则')) throw new Error('digest is missing its warning')

if (runCommand('status').text.includes('允许') !== true) throw new Error('status should start as allowed')
if (runCommand('off').kind !== 'success' || restricted !== 1) throw new Error('/fuse off did not restrict the tool')

let refused = ''
try {
  await tool.execute({ query: '任意' }, { agent, signal: new AbortController().signal })
} catch (error) {
  refused = error.message
}
if (!refused.includes('/fuse on')) throw new Error('denied tool call was not refused with recovery guidance')

const message = { id: 'u1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '跨对话融合上下文的插件怎么继续做？' }] }
const payload = { agent, turn: 1, step: 1, signal: new AbortController().signal, messages: [message], modelSelection: { provider: 'p', model: 'm' } }
const deniedStep = await preStep(payload, async () => ({ kind: 'enter', messages: [message] }))
if (deniedStep.messages.length !== 1) throw new Error('a denied conversation must not auto-fuse')

if (runCommand('on').kind !== 'success' || lifted !== 1) throw new Error('/fuse on did not lift the restriction')
const allowedStep = await preStep(payload, async () => ({ kind: 'enter', messages: [message] }))
if (allowedStep.messages.length !== 2) throw new Error('an allowed conversation did not auto-fuse')
if (Object.isFrozen(allowedStep.messages[1]) !== true) throw new Error('injected message is malformed')

const later = await preStep({ ...payload, turn: 2 }, async () => ({ kind: 'enter', messages: [message] }))
if (later.messages.length !== 1) throw new Error('a later turn must not inject')
if (runCommand('nonsense').kind !== 'error') throw new Error('an unknown argument must be rejected')

console.log('offline self-check passed')
console.log('tool →', JSON.stringify(result.sessions))
console.log('auto → injected chars:', allowedStep.messages[1].content[0].text.length)
console.log('gate → restricted', restricted, 'lifted', lifted)
