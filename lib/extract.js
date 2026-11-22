/**
 * Turn one session surface snapshot into bounded, model-readable text.
 *
 * Only what a human said and what the model answered is retained: direct user
 * messages (`source.kind === 'user'`) and assistant text. Runtime context,
 * injected snapshots, tool calls and tool results are dropped, matching the
 * projection rule the shipped session-reference service uses. That rule is what
 * keeps a fusion source from recursively quoting another fusion source.
 *
 * @module dsh-cross-session-context/extract
 */

const WHITESPACE = /\s+/gu
const ELLIPSIS = '…'

/** Messages kept for relevance scoring, beyond the rendered window. */
const SEARCH_MESSAGES = 60
/** Per-message cap inside the scoring window. */
const SEARCH_MESSAGE_CHARS = 400
/** Total cap on the scoring text. */
const SEARCH_CHARS = 20000

/**
 * Concatenate the text blocks of one message, collapsing whitespace to single
 * spaces. Collapsing is also a containment measure: source text cannot open a
 * Markdown heading or fence on its own line.
 * @param {readonly {type?: string, text?: unknown}[]} blocks - message content blocks.
 * @returns {string} normalized text, empty when the message has no text block.
 */
export function blockText(blocks) {
  if (!Array.isArray(blocks)) return ''
  const parts = []
  for (const block of blocks) {
    if (block === null || typeof block !== 'object') continue
    if (block.type !== 'text' || typeof block.text !== 'string') continue
    parts.push(block.text)
  }
  return parts.join(' ').replace(WHITESPACE, ' ').trim()
}

/**
 * Shorten one already-normalized text.
 * @param {string} text - normalized text.
 * @param {number} limit - maximum characters to keep.
 * @returns {string} the text, ellipsized when it was shortened.
 */
export function truncateText(text, limit) {
  if (text.length <= limit) return text
  if (limit <= ELLIPSIS.length) return ELLIPSIS.slice(0, limit)
  return text.slice(0, limit - ELLIPSIS.length) + ELLIPSIS
}

/**
 * Extract the retained conversation window of one surface snapshot.
 *
 * The window keeps the LAST `keepMessages` eligible messages, because the tail
 * of a session carries the work in progress. `firstUser` is the session's first
 * direct user text anywhere in the log, used as a fallback label when the
 * session has no title.
 * @param {{events?: readonly object[]}} snapshot - `SessionSurfaceSnapshot`.
 * @param {{keepMessages: number, perMessageChars: number}} limits - retention budget.
 * @returns {{messages: {role: 'user' | 'assistant', text: string}[], omitted: number, firstUser: string, searchText: string}} retained window plus scoring text.
 */
export function extractConversation(snapshot, limits) {
  const events = Array.isArray(snapshot?.events) ? snapshot.events : []
  const keepMessages = Math.max(1, limits?.keepMessages ?? 1)
  const perMessageChars = Math.max(1, limits?.perMessageChars ?? 1)
  const collected = []
  let firstUser = ''
  for (const event of events) {
    const type = event?.type
    if (type !== 'user/message' && type !== 'assistant/message') continue
    const data = event.data
    if (data === null || typeof data !== 'object') continue
    if (type === 'user/message' && data.source?.kind !== 'user') continue
    const text = blockText(data.content)
    if (text.length === 0) continue
    if (type === 'user/message' && firstUser.length === 0) firstUser = text
    collected.push({ role: type === 'user/message' ? 'user' : 'assistant', text })
  }
  const kept = collected.slice(-keepMessages).map(message => ({
    role: message.role,
    text: truncateText(message.text, perMessageChars),
  }))
  // Relevance is scored over a wider window than the rendered digest, so a
  // match on an earlier exchange still selects the session without paying to
  // render it.
  const searchText = collected.slice(-SEARCH_MESSAGES)
    .map(message => truncateText(message.text, SEARCH_MESSAGE_CHARS))
    .join(' ')
    .slice(-SEARCH_CHARS)
  return {
    messages: kept,
    omitted: Math.max(0, collected.length - kept.length),
    firstUser,
    searchText,
  }
}

/**
 * Pick the human-readable label of one source session.
 * @param {string | undefined} title - the session's latest title, when it has one.
 * @param {string} firstUser - the session's first direct user text.
 * @param {string} id - the session id, the final fallback.
 * @returns {string} a non-empty single-line label.
 */
export function sessionLabel(title, firstUser, id) {
  const clean = (value) => (typeof value === 'string' ? value.replace(WHITESPACE, ' ').trim() : '')
  const fromTitle = clean(title)
  if (fromTitle.length > 0) return truncateText(fromTitle, 60)
  const fromMessage = clean(firstUser)
  if (fromMessage.length > 0) return truncateText(fromMessage, 40)
  return id.replace(/^session-/u, '').slice(0, 8) || id.slice(0, 8)
}
