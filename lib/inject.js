/**
 * Build the durable context message a pre-step listener appends.
 *
 * Shape matches the shipped session-reference service: an identified user-role
 * message carrying its own producer kind in `source`. The kind matters — it is
 * what keeps a fusion digest from being re-fused as if a human had typed it, so
 * digests never nest inside one another. Session validation only requires a
 * non-empty `source.kind` for user messages, and consumers fall through unknown
 * kinds. Everything is frozen because request derivation assumes immutable
 * messages.
 *
 * @module dsh-cross-session-context/inject
 */
import { randomUUID } from 'node:crypto'

/** Producer kind recorded on every injected digest. */
export const CONTEXT_SOURCE_KIND = 'cross-session-context'

/**
 * Create one frozen user message carrying the digest.
 * @param {string} text - the rendered digest.
 * @returns {{id: string, role: 'user', content: readonly {type: 'text', text: string}[], source: {kind: string}}} the message.
 */
export function buildContextMessage(text) {
  const content = Object.freeze([Object.freeze({ type: 'text', text: String(text) })])
  return Object.freeze({
    id: randomUUID(),
    role: 'user',
    content,
    source: Object.freeze({ kind: CONTEXT_SOURCE_KIND }),
  })
}

/**
 * Concatenate the text blocks of one user message.
 * @param {{content?: readonly {type?: string, text?: unknown}[]}} message - an admitted user message.
 * @returns {string} normalized text.
 */
export function messageText(message) {
  const blocks = message?.content
  if (!Array.isArray(blocks)) return ''
  const parts = []
  for (const block of blocks) {
    if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text)
    }
  }
  return parts.join(' ').replace(/\s+/gu, ' ').trim()
}
