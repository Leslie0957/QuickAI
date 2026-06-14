import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request as httpRequest } from 'node:http'
import { withUpload, requireUploadPlan } from '../configs/multer.js'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'quickai-test-'))
  const app = express()
  let calls = 0
  app.post('/:mode', (req, res, next) => {
    req.plan = req.params.mode === 'denied' ? 'free' : 'premium'
    next()
  }, requireUploadPlan, withUpload('file', async (req, res) => {
    calls++
    assert.equal((await readFile(req.file.path)).toString(), 'hello')
    if (req.params.mode === 'fail') throw new Error('Processing failed')
    if (req.params.mode === 'rejected') return res.status(403).json({ success: false })
    if (req.params.mode === 'stream' || req.params.mode === 'stream-fail') {
      res.set('Content-Type', 'text/event-stream')
      res.flushHeaders()
      res.write('event: chunk\ndata: {"text":"hello"}\n\n')
      await delay(80)
      if (req.params.mode === 'stream-fail') throw new Error('Stream failed')
      assert.equal((await readFile(req.file.path)).toString(), 'hello')
      res.write('event: done\ndata: {}\n\n')
      return res.end()
    }
    if (req.params.mode === 'slow') await delay(80)
    res.json({ success: true })
  }, { directory, maxSize: 32 }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  const empty = async () => {
    for (let i = 0; i < 100; i++) {
      if (!(await readdir(directory)).length) return
      await delay(20)
    }
    assert.deepEqual(await readdir(directory), [])
  }
  try { await run({ url, directory, empty, calls: () => calls }) }
  finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
}
function body(value = 'hello', field = 'file') {
  const form = new FormData()
  form.append(field, new Blob([value]), 'test.bin')
  return form
}
for (const [mode, status] of [['ok', 200], ['fail', 500], ['rejected', 403]]) {
  test(`cleans upload after ${mode}`, () => fixture(async ({ url, empty, calls }) => {
    const response = await fetch(`${url}/${mode}`, { method: 'POST', body: body() })
    assert.equal(response.status, status)
    await empty()
    assert.equal(calls(), 1)
  }))
}
test('permission rejection creates no files and manual retry checks permissions again', () => fixture(async ({ url, empty, calls }) => {
  for (let i = 0; i < 2; i++) {
    assert.equal((await fetch(`${url}/denied`, { method: 'POST', body: body() })).status, 403)
    await empty()
  }
  assert.equal(calls(), 0)
}))
test('cleans oversized and unexpected field uploads', () => fixture(async ({ url, empty, calls }) => {
  for (const form of [body('x'.repeat(100)), body('hello', 'wrong')]) {
    assert.equal((await fetch(`${url}/ok`, { method: 'POST', body: form })).status, 400)
    await empty()
  }
  assert.equal(calls(), 0)
}))
test('cleans malformed multipart including partial file', () => fixture(async ({ url, empty, calls }) => {
  await fetch(`${url}/ok`, { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
    body: '--test\r\nContent-Disposition: form-data; name="file"; filename="test.bin"\r\nContent-Type: application/octet-stream\r\n\r\nhello',
  })
  await empty()
  assert.equal(calls(), 0)
}))
test('cleans files when client disconnects mid-upload', () => fixture(async ({ url, directory, empty, calls }) => {
  const request = httpRequest(`${url}/ok`, { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=test' } })
  request.on('error', () => {})
  request.write('--test\r\nContent-Disposition: form-data; name="file"; filename="test.bin"\r\nContent-Type: application/octet-stream\r\n\r\nhello')
  for (let i = 0; i < 100; i++) {
    const dirs = await readdir(directory)
    if (dirs.length && (await readdir(join(directory, dirs[0]))).length) break
    await delay(10)
  }
  assert.equal((await readdir(directory)).length, 1)
  request.destroy()
  await empty()
  assert.equal(calls(), 0)
}))
test('keeps file until asynchronous processing finishes, then cleans it', () => fixture(async ({ url, directory, empty }) => {
  const response = fetch(`${url}/slow`, { method: 'POST', body: body() })
  await delay(40)
  assert.equal((await readdir(directory)).length, 1)
  assert.equal((await response).status, 200)
  await empty()
}))

test('SSE chunks arrive before processing ends and files are removed before response completion', () => fixture(async ({ url, directory }) => {
  const response = await fetch(`${url}/stream`, { method: 'POST', body: body() })
  const reader = response.body.getReader()
  const first = await reader.read()
  assert.match(new TextDecoder().decode(first.value), /event: chunk/)
  assert.equal((await readdir(directory)).length, 1)
  while (!(await reader.read()).done) { /* Drain the SSE response. */ }
  assert.deepEqual(await readdir(directory), [])
}))
test('disconnect during processing waits for file reads before cleanup', () => fixture(async ({ url, empty }) => {
  const response = await fetch(`${url}/stream`, { method: 'POST', body: body() })
  await response.body.cancel()
  await empty()
}))

test('failure after SSE headers closes the stream and removes files', () => fixture(async ({ url, directory }) => {
  const response = await fetch(`${url}/stream-fail`, { method: 'POST', body: body() })
  const text = await response.text()
  assert.match(text, /event: chunk/)
  assert.doesNotMatch(text, /event: done/)
  assert.deepEqual(await readdir(directory), [])
}))
