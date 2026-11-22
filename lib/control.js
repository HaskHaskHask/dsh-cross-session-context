/**
 * `/fuse` command grammar and the wording of its outcomes.
 *
 * Kept pure so the acceptance rules are unit-tested without a host: the command
 * toggles whether one conversation may use the fusion plugin at all.
 *
 * @module dsh-cross-session-context/control
 */

/** Command name without the leading slash. */
export const FUSE_COMMAND_NAME = 'fuse'

/**
 * Parse the text following `/fuse`.
 * @param {unknown} rawInput - adapter-delivered suffix, including separators.
 * @returns {'status' | 'on' | 'off' | null} the requested action, or null when unusable.
 */
export function parseFuseArgs(rawInput) {
  const text = typeof rawInput === 'string' ? rawInput.trim().toLowerCase() : ''
  if (text === '' || text === 'status') return 'status'
  if (text === 'on' || text === 'enable' || text === 'allow') return 'on'
  if (text === 'off' || text === 'disable' || text === 'deny') return 'off'
  return null
}

/** Prompt shown when the argument is not understood. */
export const FUSE_USAGE = '用法：/fuse [on|off|status]——on 允许本对话使用跨会话融合，off 拒绝，status 查看当前状态。'

/**
 * Describe one conversation's current fusion permission.
 * @param {boolean} allowed - whether fusion is currently allowed.
 * @returns {string} the status line.
 */
export function fuseStatusText(allowed) {
  return allowed
    ? '跨会话融合：允许。模型可调用 fuse_session_context，新对话首轮也可能自动融合。'
    : '跨会话融合：已拒绝。本对话不再调用 fuse_session_context，也不会自动融合；执行 /fuse on 恢复。'
}

/**
 * Confirm a permission change.
 * @param {boolean} allowed - the new permission.
 * @returns {string} the confirmation line.
 */
export function fuseChangeText(allowed) {
  return allowed
    ? '已允许本对话使用跨会话融合。'
    : '已拒绝本对话使用跨会话融合：后续步骤不再提供 fuse_session_context，也不会自动融合。'
}
