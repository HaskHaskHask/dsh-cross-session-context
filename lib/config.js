/**
 * Configuration defaults and validation.
 *
 * The plugin validates at activation and refuses to load on a bad value: a
 * silently clamped budget would change what reaches the model without telling
 * anyone. Every field is optional; `resolveConfig(undefined)` yields the
 * defaults.
 *
 * @module dsh-cross-session-context/config
 */

/** Default configuration for every tunable field. */
export const DEFAULTS = Object.freeze({
  enabled: true,
  auto: true,
  autoMaxSessions: 1,
  autoMinScore: 0.25,
  maxSessions: 2,
  scanLimit: 6,
  minScore: 0.08,
  minQueryChars: 4,
  keepMessages: 12,
  perMessageChars: 500,
  charsPerSession: 3000,
  totalChars: 6000,
  includeSubagents: true,
  excludeParentSession: true,
})

/** Integer bounds per field: [min, max]. */
const INT_BOUNDS = Object.freeze({
  autoMaxSessions: [1, 3],
  maxSessions: [1, 3],
  scanLimit: [1, 20],
  minQueryChars: [1, 200],
  keepMessages: [1, 50],
  perMessageChars: [80, 8000],
  charsPerSession: [200, 20000],
  totalChars: [500, 40000],
})

const RATIO_FIELDS = Object.freeze(['autoMinScore', 'minScore'])
const BOOLEAN_FIELDS = Object.freeze(['enabled', 'auto', 'includeSubagents', 'excludeParentSession'])

/**
 * Reject one unusable value with a field-named message.
 * @param {string} name - configuration field.
 * @param {string} expected - human description of the accepted input.
 * @returns {never} always throws.
 */
function reject(name, expected) {
  throw new Error(`cross-session-context: "${name}" must be ${expected}`)
}

/**
 * Merge a row's configuration over the defaults and validate every field.
 * @param {unknown} raw - the row config, already parsed by the loader.
 * @returns {typeof DEFAULTS} a frozen, fully resolved configuration.
 */
export function resolveConfig(raw) {
  if (raw === undefined || raw === null) return DEFAULTS
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('cross-session-context: config must be an object')
  }
  const known = new Set(Object.keys(DEFAULTS))
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) {
      throw new Error(`cross-session-context: unknown config setting "${key}"; accepted settings are ${[...known].join(', ')}`)
    }
  }
  const resolved = { ...DEFAULTS }
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue
    if (BOOLEAN_FIELDS.includes(key)) {
      if (typeof value !== 'boolean') reject(key, 'a boolean')
      resolved[key] = value
      continue
    }
    if (RATIO_FIELDS.includes(key)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        reject(key, 'a number between 0 and 1')
      }
      resolved[key] = value
      continue
    }
    if (key in INT_BOUNDS) {
      const [min, max] = INT_BOUNDS[key]
      if (!Number.isSafeInteger(value) || value < min || value > max) {
        reject(key, `an integer between ${min} and ${max}`)
      }
      resolved[key] = value
      continue
    }
    reject(key, 'a supported value')
  }
  if (resolved.totalChars < resolved.charsPerSession) {
    throw new Error('cross-session-context: "totalChars" must be at least "charsPerSession"')
  }
  return Object.freeze(resolved)
}

/**
 * Describe the row's settings for the Plugin Manager form.
 *
 * Mirrors the duck-typed schema a packaged plugin ships (a plain descriptor
 * plus a Standard Schema `validate`), so this plugin needs no framework import.
 * @returns {object} the config descriptor.
 */
export function createConfigSchema() {
  const dict = {}
  for (const [key, value] of Object.entries(DEFAULTS)) {
    dict[key] = { type: typeof value, meta: { description: '' } }
  }
  return Object.assign({ type: 'object', dict }, {
    '~standard': {
      version: 1,
      vendor: 'dsh-cross-session-context',
      validate(value) {
        try {
          return { value: resolveConfig(value) }
        } catch (error) {
          return { issues: [{ message: error instanceof Error ? error.message : String(error) }] }
        }
      },
    },
  })
}
