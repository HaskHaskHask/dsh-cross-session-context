/**
 * Candidate selection over the logical session corpus.
 *
 * The corpus records come from `ctx.sessionQuery.filterSessions`. This module
 * is pure: it decides which sessions may be read as fusion sources, in the
 * order they are worth reading.
 *
 * @module dsh-cross-session-context/scan
 */

/**
 * Keep sessions this agent may read, newest first.
 *
 * Excluded: the current session, its direct parent (a subagent already inherits
 * its parent's task), subagent sessions when disabled, and sessions recorded in
 * another working directory. A session with no recorded cwd is kept only when
 * the requesting session also has none, so an unrecorded workspace still fuses.
 * @param {readonly {header?: object}[]} records - logical corpus records.
 * @param {object} options - selection rules.
 * @param {string} options.selfId - requesting session id.
 * @param {string} [options.parentId] - requesting session's direct parent.
 * @param {string} [options.cwd] - requesting session's working directory.
 * @param {boolean} options.includeSubagents - whether subagent sessions qualify.
 * @param {boolean} options.excludeParentSession - whether the parent is excluded.
 * @returns {{id: string, createdAt: number, cwd: string | undefined}[]} candidates, newest first.
 */
export function selectCandidates(records, options) {
  const { selfId, parentId, cwd, includeSubagents, excludeParentSession } = options
  const keep = []
  for (const record of Array.isArray(records) ? records : []) {
    const header = record?.header
    if (header === null || typeof header !== 'object') continue
    const id = header.id
    if (typeof id !== 'string' || id.length === 0) continue
    if (id === selfId) continue
    if (excludeParentSession && typeof parentId === 'string' && id === parentId) continue
    if (!includeSubagents && header.origin === 'subagent') continue
    if (cwd !== undefined && header.cwd !== cwd) continue
    keep.push({
      id,
      createdAt: Number.isFinite(header.createdAt) ? Number(header.createdAt) : 0,
      cwd: typeof header.cwd === 'string' ? header.cwd : undefined,
    })
  }
  keep.sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id))
  return keep
}

/**
 * Drop duplicates while keeping the first occurrence.
 * @param {readonly string[]} ids - requested session ids.
 * @returns {string[]} unique ids.
 */
export function uniqueIds(ids) {
  const seen = new Set()
  const unique = []
  for (const id of Array.isArray(ids) ? ids : []) {
    if (typeof id !== 'string') continue
    const trimmed = id.trim()
    if (trimmed.length === 0 || seen.has(trimmed)) continue
    seen.add(trimmed)
    unique.push(trimmed)
  }
  return unique
}
