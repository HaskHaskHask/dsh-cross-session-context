/**
 * Lexical relevance between the current request and a candidate session.
 *
 * The deployment's full-text index can be switched off (`session-query-sqlite`
 * with `openAt: never`), so this module never asks a search backend. It scores
 * already-extracted text, which the caller must read anyway for the digest.
 *
 * Tokenization covers both scripts: ASCII/digit words of two or more
 * characters, and CJK bigrams (a two-character sliding window). Bigrams give
 * usable overlap for Chinese without a dictionary or a segmenter.
 *
 * @module dsh-cross-session-context/score
 */

const WORD = /[a-z0-9_]+/gu
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/gu

/**
 * Tokenize one text into a set of comparison terms.
 * @param {unknown} text - any text; non-strings tokenize to nothing.
 * @returns {Set<string>} unique terms.
 */
export function tokenize(text) {
  const terms = new Set()
  if (typeof text !== 'string' || text.length === 0) return terms
  const lower = text.toLowerCase()
  for (const word of lower.match(WORD) ?? []) {
    if (word.length >= 2) terms.add(word)
  }
  for (const run of lower.match(CJK) ?? []) {
    if (run.length === 1) {
      terms.add(run)
      continue
    }
    for (let index = 0; index + 1 < run.length; index += 1) terms.add(run.slice(index, index + 2))
  }
  return terms
}

/**
 * Fraction of the request's terms that the document also contains.
 *
 * Coverage (rather than Jaccard) keeps the score stable when the document is
 * much longer than the request: a session that mentions everything the request
 * asks about scores high even if it also contains a lot of unrelated work.
 * @param {unknown} query - the current request text.
 * @param {unknown} document - the candidate session text.
 * @returns {number} a score in [0, 1]; 0 when the request has no terms.
 */
export function coverage(query, document) {
  const queryTerms = tokenize(query)
  if (queryTerms.size === 0) return 0
  const documentTerms = tokenize(document)
  if (documentTerms.size === 0) return 0
  let hits = 0
  for (const term of queryTerms) {
    if (documentTerms.has(term)) hits += 1
  }
  return hits / queryTerms.size
}

/**
 * Rank candidates by relevance, with a small recency tiebreaker.
 *
 * An empty query ranks purely by recency (newest first). With a query, the
 * recency bonus is at most 0.05 so it can only reorder near-ties, never promote
 * an unrelated session over a matching one.
 * @param {{id: string, createdAt: number, text: string}[]} candidates - readable sources.
 * @param {string} query - the current request text; empty for recency order.
 * @returns {{id: string, createdAt: number, text: string, score: number, rank: number}[]} ranked candidates, best first.
 */
export function rankCandidates(candidates, query) {
  const total = Math.max(1, candidates.length)
  const ranked = candidates.map((candidate, index) => {
    const recency = 1 - index / total
    const score = typeof query === 'string' && query.trim().length > 0
      ? coverage(query, candidate.text)
      : 0
    return {
      id: candidate.id,
      createdAt: candidate.createdAt,
      text: candidate.text,
      score,
      rank: score + (query.trim().length > 0 ? 0.05 * recency : recency),
    }
  })
  ranked.sort((left, right) => right.rank - left.rank || right.createdAt - left.createdAt)
  return ranked
}
