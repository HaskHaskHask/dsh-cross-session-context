import test from 'node:test'
import assert from 'node:assert/strict'
import { coverage, rankCandidates, tokenize } from '../lib/score.js'

test('tokenize splits ASCII words and CJK bigrams', () => {
  const terms = tokenize('Compact the 上下文压缩 pipeline')
  assert.equal(terms.has('compact'), true)
  assert.equal(terms.has('the'), true)
  assert.equal(terms.has('pipeline'), true)
  // 上下文压缩 → 上下 / 下文 / 文压 / 压缩
  assert.equal(terms.has('上下'), true)
  assert.equal(terms.has('压缩'), true)
  assert.equal(terms.has('下文'), true)
})

test('tokenize drops single-character ASCII and keeps single-character CJK runs', () => {
  const terms = tokenize('a 好 b')
  assert.equal(terms.has('a'), false)
  assert.equal(terms.has('b'), false)
  assert.equal(terms.has('好'), true)
})

test('tokenize tolerates non-strings', () => {
  assert.equal(tokenize(undefined).size, 0)
  assert.equal(tokenize(42).size, 0)
})

test('coverage is the fraction of request terms the document contains', () => {
  const doc = 'compact the conversation context'
  assert.equal(coverage('conversation context', doc), 1)
  assert.equal(coverage('conversation unrelated', doc), 0.5)
  assert.equal(coverage('nothing here', doc), 0)
})

test('coverage is zero for an empty request', () => {
  assert.equal(coverage('', 'anything'), 0)
})

test('empty query keeps the incoming (newest-first) order', () => {
  const ranked = rankCandidates([
    { id: 'old', createdAt: 1, text: 'alpha' },
    { id: 'new', createdAt: 3, text: 'beta' },
    { id: 'mid', createdAt: 2, text: 'gamma' },
  ], '')
  assert.deepEqual(ranked.map(entry => entry.id), ['old', 'new', 'mid'])
})

test('a non-empty query puts the matching session first', () => {
  const ranked = rankCandidates([
    { id: 'unrelated', createdAt: 9, text: '打包 发布 流程' },
    { id: 'related', createdAt: 1, text: '上下文压缩 阈值 与 摘要' },
  ], '上下文压缩的阈值是多少')
  assert.equal(ranked[0].id, 'related')
  assert.equal(ranked[0].score > 0, true)
})

test('ordering without a query follows the input order (already newest first)', () => {
  const ranked = rankCandidates([
    { id: 'first', createdAt: 9, text: '' },
    { id: 'second', createdAt: 8, text: '' },
  ], '')
  assert.deepEqual(ranked.map(entry => entry.id), ['first', 'second'])
})
