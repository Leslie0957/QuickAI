import test from 'node:test'
import assert from 'node:assert/strict'
import { articleContinuationOptions, continuationFilter, continuationResponseFilter } from '../services/articleContinuation.js'

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

test('explicit boundaries fix missing model whitespace while preserving unfinished words and Chinese', () => {
    const cases = [
        ['Some hellos are', '[[JOIN:SPACE]]more than casual.', 'Some hellos are more than casual.'],
        ['Why does', '[[JOIN:SPACE]]the phrase stick?', 'Why does the phrase stick?'],
        ['distinctive characteristic and the', '[[JOIN:SPACE]]source of its impossibility.', 'distinctive characteristic and the source of its impossibility.'],
        ['Why does ', '[[JOIN:SPACE]]the phrase stick?', 'Why does the phrase stick?'],
        ['Why does', '[[JOIN:SPACE]] the phrase stick?', 'Why does the phrase stick?'],
        ['The exam', '[[JOIN:NONE]]ple is clear.', 'The example is clear.'],
        ['人工智能正在', '[[JOIN:NONE]]改变生活。', '人工智能正在改变生活。'],
        ['Hello', '[[JOIN:NONE]], world.', 'Hello, world.'],
        ['Heading', '[[JOIN:LINE]]Body', 'Heading\nBody'],
        ['First paragraph.', '[[JOIN:PARAGRAPH]]Second paragraph.', 'First paragraph.\n\nSecond paragraph.'],
        ['First paragraph.\n', '[[JOIN:PARAGRAPH]]Second paragraph.', 'First paragraph.\n\nSecond paragraph.'],
        ['First paragraph.\n\n', '[[JOIN:PARAGRAPH]]Second paragraph.', 'First paragraph.\n\nSecond paragraph.'],
        ['First paragraph.', '[[JOIN:PARAGRAPH]]\n\nSecond paragraph.', 'First paragraph.\n\nSecond paragraph.'],
    ]
    for (const [previous, response, expected] of cases) {
        // Exercise every two-chunk split, plus one-character provider chunks.
        const deliveries = [Array.from(response)]
        for (let split = 0; split <= response.length; split++) {
            deliveries.push([response.slice(0, split), response.slice(split)])
        }
        for (const chunks of deliveries) {
            const filter = continuationResponseFilter(previous)
            let output = ''
            for (const chunk of chunks) output += filter.push(chunk)
            output += filter.finish()
            assert.equal(previous + output, expected)
            assert.ok(!output.includes('[[JOIN:'))
        }
    }
})

test('boundary framing still removes repeated draft tails across provider chunks', () => {
    const previous = 'Introduction. The next important consideration is'
    const filter = continuationResponseFilter(previous)
    let output = ''
    for (const char of '[[JOIN:SPACE]]The next important consideration is reliability.') output += filter.push(char)
    output += filter.finish()
    assert.equal(previous + output, previous + ' reliability.')
})

test('invalid or incomplete markers fail before leaking protocol text into the draft', () => {
    for (const response of ['more text', '[[JOIN:UNKNOWN]]more', '[[JOIN:SPA', '']) {
        const filter = continuationResponseFilter('Some hellos are')
        let output = ''
        assert.throws(() => {
            for (const char of response) output += filter.push(char)
            output += filter.finish()
        }, /continuation boundary/)
        assert.equal(output, '')
    }
})
