import test from 'node:test'
import assert from 'node:assert/strict'
import { continueArticle } from '../src/api/ai.js'

test('continuation sends original parameters and keeps delivered text when the new stream fails', async () => {
  const original = globalThis.fetch
  const controller = new AbortController()
  const parameters = { topic: 'Original topic', length: 800, lengthLabel: 'Short', previousContent: 'Existing text' }
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/api/ai/continue-article'))
    assert.deepEqual(JSON.parse(options.body), parameters)
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.equal(options.signal, controller.signal)
    return new Response('event: chunk\ndata: {"text":" more text"}\n\nevent: error\ndata: {"message":"Interrupted"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }
  try {
    let content = parameters.previousContent
    await assert.rejects(continueArticle({ ...parameters, token: 'test-token', signal: controller.signal,
      onChunk: (text) => { content += text },
    }), /Interrupted/)
    assert.equal(content, 'Existing text more text')
  } finally { globalThis.fetch = original }
})
