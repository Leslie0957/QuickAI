import test from 'node:test'
import assert from 'node:assert/strict'
import { articleContinuationOptions, continuationFilter } from '../services/articleContinuation.js'

test('removes a repeated suffix even when split into individual stream characters', () => {
    const previous = 'Introduction. The next important consideration is'
    const filter = continuationFilter(previous)
    let output = ''
    for (const char of 'The next important consideration is reliability.') output += filter.push(char)
    output += filter.finish()
    assert.equal(previous + output, previous + ' reliability.')
})

test('preserves an unfinished word, whitespace, unicode and legitimate short repetitions', () => {
    for (const [previous, next] of [['The exam', 'ple is clear.'], ['第一段。', '\n\n第二段。'], ['very ', 'very useful']]) {
        const filter = continuationFilter(previous)
        assert.equal(filter.push(next) + filter.finish(), next)
    }
})

test('flushes a short ambiguous prefix at end of stream', () => {
    const filter = continuationFilter('Some previous text ending in a long phrase')
    assert.equal(filter.push('ending'), '')
    assert.equal(filter.finish(), 'ending')
})

test('bounds model context while retaining the entire original for saving', () => {
    const previousContent = '开始\n' + 'a'.repeat(30000) + '\n结束'
    const options = articleContinuationOptions({ topic: 'AI', length: 1600, lengthLabel: 'Long', previousContent })
    assert.equal(options.previousContent, previousContent)
    assert.ok(options.prompt.length < 16000)
    assert.match(options.prompt, /开始/)
    assert.match(options.prompt, /结束$/)
    assert.equal(options.maxTokens, 10000)
})

test('rejects missing drafts, invalid lengths and excessive payloads before provider calls', () => {
    const valid = { topic: 'AI', length: 800, lengthLabel: 'Short', previousContent: 'A partial article' }
    for (const patch of [{ previousContent: '' }, { length: -1 }, { topic: null }, { previousContent: '文'.repeat(30000) }]) {
        assert.throws(() => articleContinuationOptions({ ...valid, ...patch }), /Cannot continue/)
    }
})
