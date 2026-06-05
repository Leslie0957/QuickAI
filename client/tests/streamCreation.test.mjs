import test from 'node:test'
import assert from 'node:assert/strict'
import { streamCreation } from '../src/utils/streamCreation.js'

const encoder = new TextEncoder()
const baseUrl = 'https://example.test'

function responseFromParts(parts) {
  return new Response(new ReadableStream({
    start(controller) {
      const bytes = encoder.encode(parts.join(''))
      for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3))
      controller.close()
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } })
}

test('reads split SSE frames and Unicode chunks in order', async () => {
  const originalFetch = globalThis.fetch
  const pieces = [
    'event: chunk\ndata: {"text":"你',
    '好"}\n\nevent: chunk\ndata: {"text":" world"}\n\n',
    'event: done\ndata: {}\n\n',
  ]
  let calledUrl
  let calledOptions
  globalThis.fetch = async (url, options) => {
    calledUrl = url
    calledOptions = options
    return responseFromParts(pieces)
  }
  try {
    const chunks = []
    await streamCreation({
      baseUrl, path: '/api/ai/generate-article', prompt: 'test', length: 800,
      token: 'test-token', onChunk: (text) => chunks.push(text),
    })
    assert.deepEqual(chunks, ['你好', ' world'])
    assert.equal(calledUrl, 'https://example.test/api/ai/generate-article')
    assert.equal(calledOptions.headers.Authorization, 'Bearer test-token')
    assert.equal(calledOptions.headers.Accept, 'text/event-stream')
    assert.deepEqual(JSON.parse(calledOptions.body), { prompt: 'test', length: 800 })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('reports server error after partial output', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => responseFromParts([
    'event: chunk\ndata: {"text":"partial"}\n\n',
    'event: error\ndata: {"message":"cut off"}\n\n',
  ])
  try {
    const chunks = []
    await assert.rejects(
      streamCreation({ baseUrl, path: '/x', prompt: 'x', token: 't', onChunk: (text) => chunks.push(text) }),
      /cut off/,
    )
    assert.deepEqual(chunks, ['partial'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('rejects a stream that closes without done', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => responseFromParts(['event: chunk\ndata: {"text":"partial"}\n\n'])
  try {
    await assert.rejects(
      streamCreation({ baseUrl, path: '/x', prompt: 'x', token: 't', onChunk: () => {} }),
      /before completion/,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('keeps the existing JSON limit error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => Response.json({ success: false, message: 'Limit reached' })
  try {
    await assert.rejects(
      streamCreation({ baseUrl, path: '/x', prompt: 'x', token: 't', onChunk: () => {} }),
      /Limit reached/,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
