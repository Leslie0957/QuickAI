import test from 'node:test'
import assert from 'node:assert/strict'
import { http, request, reportUpload } from '../src/api/http.js'
import { generateArticle, generateBlogTitles, generateImage, getImageQuota, removeBackground, removeObject, reviewResume } from '../src/api/ai.js'
import { streamCreation, createSSEParser } from '../src/api/stream.js'

const token = 'test-token'
test('business methods preserve JSON payloads, auth, quotas and error metadata without retry', async () => {
  const original = http.defaults.adapter
  const calls = []
  http.defaults.adapter = async (config) => {
    calls.push(config)
    return { status: 200, data: { success: true, remaining: 9 }, config }
  }
  try {
    await generateImage({ description: ' cat ', style: '3D', publish: true, getToken: async () => token })
    await getImageQuota({ token })
    assert.equal(calls[0].url, '/api/ai/generate-image')
    assert.equal(calls[0].headers.Authorization, 'Bearer test-token')
    assert.deepEqual(JSON.parse(calls[0].data), { prompt: 'Generate an image of cat in the style 3D', publish: true })
    assert.equal(calls[1].url, '/api/ai/image-quota')
    let failures = 0
    http.defaults.adapter = async () => { failures++; throw { response: { status: 429, data: { remaining: 0, message: 'Limit reached' } } } }
    await assert.rejects(getImageQuota({ token }), (error) => error.status === 429 && error.data.remaining === 0 && error.message === 'Limit reached')
    assert.equal(failures, 1)
    http.defaults.adapter = async () => ({ status: 200, data: { success: false, message: 'Permission denied' } })
    await assert.rejects(request({ token }), /Permission denied/)
  } finally { http.defaults.adapter = original }
})
test('text business methods keep prompts and stream immediately', async () => {
  const original = globalThis.fetch
  const payloads = []
  globalThis.fetch = async (_url, options) => {
    payloads.push(JSON.parse(options.body))
    return new Response('event: chunk\ndata: {"text":"hello"}\n\nevent: done\ndata: {}\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
  }
  try {
    const chunks = []
    await generateArticle({ topic: 'AI', length: 800, lengthLabel: 'Short', token, onChunk: (text) => chunks.push(text) })
    await generateBlogTitles({ keyword: 'AI', category: 'Technology', token, onChunk: (text) => chunks.push(text) })
    assert.deepEqual(chunks, ['hello', 'hello'])
    assert.equal(payloads[0].length, 800)
    assert.match(payloads[0].prompt, /AI.*Short/)
    assert.match(payloads[1].prompt, /AI.*Technology/)
  } finally { globalThis.fetch = original }
})
test('parser handles CRLF split across packets and requires done', () => {
  const chunks = []
  const parser = createSSEParser((text) => chunks.push(text))
  for (const char of 'event: chunk\r\ndata: {"text":"中文"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n') parser.push(char)
  parser.finish()
  assert.deepEqual(chunks, ['中文'])
  assert.throws(() => createSSEParser(() => {}).finish(), /before completion/)
})
test('progress reflects actual byte counts and switches to processing at completion', () => {
  const events = []
  for (const event of [{ loaded: 20, total: 100 }, { loaded: 100, total: 100 }, { loaded: 50 }]) reportUpload(event, (p) => events.push(p))
  assert.deepEqual(events, [{ phase: 'uploading', percent: 20 }, { phase: 'processing', percent: 100 }, { phase: 'uploading', percent: null }])
})
class MockXHR {
  static last
  constructor() { MockXHR.last = this; this.upload = {}; this.headers = {}; this.responseText = ''; this.status = 200 }
  open(method, url) { this.method = method; this.url = url }
  setRequestHeader(key, value) { this.headers[key] = value }
  getResponseHeader() { return this.type || 'text/event-stream' }
  send(body) { this.body = body }
  abort() { this.aborted = true; this.onabort?.() }
}
async function startResume(extra = {}) {
  const promise = reviewResume({ file: new Blob(['pdf']), token, onChunk: () => {}, onUploadProgress: () => {}, ...extra })
  await new Promise((resolve) => setImmediate(resolve))
  return { promise, xhr: MockXHR.last }
}
test('resume XHR reports upload, displays chunks before completion and preserves multipart boundary', async () => {
  const original = globalThis.XMLHttpRequest
  globalThis.XMLHttpRequest = MockXHR
  try {
    const chunks = [], progress = []
    const { promise, xhr } = await startResume({ onChunk: (text) => chunks.push(text), onUploadProgress: (p) => progress.push(p) })
    assert.equal(xhr.headers.Authorization, 'Bearer test-token')
    assert.equal(xhr.headers['Content-Type'], undefined)
    assert.ok(xhr.body.get('resume') instanceof Blob)
    xhr.upload.onprogress({ loaded: 5, total: 10 })
    xhr.upload.onload()
    xhr.responseText = 'event: chunk\ndata: {"text":"hello"}\n\n'
    xhr.onprogress()
    assert.deepEqual(chunks, ['hello'])
    assert.deepEqual(progress, [{ phase: 'uploading', percent: 50 }, { phase: 'processing', percent: 100 }])
    xhr.responseText += 'event: done\ndata: {}\n\n'
    xhr.onload()
    await promise
  } finally { globalThis.XMLHttpRequest = original }
})
test('resume XHR handles JSON errors, truncated streams, network errors and cancellation without retry', async () => {
  const original = globalThis.XMLHttpRequest
  globalThis.XMLHttpRequest = MockXHR
  try {
    for (const mode of ['json', 'truncated', 'network', 'cancel']) {
      const controller = new AbortController()
      const { promise, xhr } = await startResume({ signal: controller.signal })
      const rejected = assert.rejects(promise, mode === 'cancel' ? { name: 'AbortError' } : /Permission|completion|Network/)
      if (mode === 'json') { xhr.type = 'application/json'; xhr.status = 403; xhr.responseText = '{"message":"Permission denied"}'; xhr.onload() }
      if (mode === 'truncated') xhr.onload()
      if (mode === 'network') xhr.onerror()
      if (mode === 'cancel') controller.abort()
      await rejected
      assert.equal(MockXHR.last, xhr)
    }
  } finally { globalThis.XMLHttpRequest = original }
})
test('cancellation during token acquisition sends no request', async () => {
  const controller = new AbortController()
  await assert.rejects(streamCreation({ path: '/x', signal: controller.signal, getToken: async () => { controller.abort(); return token } }), { name: 'AbortError' })
})

test('image editing methods upload original files and retry only when explicitly called', async () => {
  const original = http.request
  const calls = []
  let authCalls = 0
  const getToken = async () => { authCalls++; return token }
  const file = new File(['image'], 'photo.png', { type: 'image/png' })
  http.request = async (config) => {
    calls.push(config)
    if (calls.length === 1) return { status: 200, data: { success: false, message: 'Processing failed' } }
    return { status: 200, data: { success: true, content: 'image-url' } }
  }
  try {
    await assert.rejects(removeBackground({ file, getToken }), /Processing failed/)
    assert.equal(calls.length, 1)
    assert.equal((await removeBackground({ file, getToken })).content, 'image-url')
    const progress = []
    await removeObject({ file, object: 'watch', getToken, onUploadProgress: (p) => progress.push(p) })
    assert.equal(authCalls, 3)
    assert.equal(calls[0].url, '/api/ai/remove-image-background')
    assert.equal(calls[2].url, '/api/ai/remove-image-object')
    assert.equal(calls[2].data.get('image'), file)
    assert.equal(calls[2].data.get('object'), 'watch')
    assert.equal(calls[2].headers.Authorization, 'Bearer test-token')
    calls[2].onUploadProgress({ loaded: 4, total: 4 })
    assert.deepEqual(progress, [{ phase: 'processing', percent: 100 }])
  } finally { http.request = original }
})
