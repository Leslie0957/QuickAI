import { authHeaders, baseURL, toApiError, abortError, reportUpload } from './http.js'

export function createSSEParser(onChunk) {
  let buffer = ''
  let completed = false
  const event = (raw) => {
    const lines = raw.split(/\r?\n/)
    const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
    const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
    if (!type || !data) return
    const payload = JSON.parse(data)
    if (type === 'error') throw new Error(payload.message || 'Generation failed.')
    if (type === 'chunk' && !completed) onChunk(payload.text)
    if (type === 'done') completed = true
  }
  const push = (text) => {
    buffer += text
    let separator
    while ((separator = /\r?\n\r?\n/.exec(buffer))) {
      event(buffer.slice(0, separator.index))
      buffer = buffer.slice(separator.index + separator[0].length)
    }
  }
  return {
    push,
    finish() {
      if (buffer.trim()) event(buffer)
      buffer = ''
      if (!completed) throw new Error('Generation stopped before completion. Please try again.')
    },
  }
}

function responseError(text, status) {
  let data
  try { data = JSON.parse(text) } catch { /* Non-JSON gateway response. */ }
  return toApiError({ message: data?.message || `Generation failed (HTTP ${status}).`, status, data })
}

// XHR exposes actual upload bytes and incremental responseText for multipart SSE.
function uploadStream({ url, headers, formData, signal, onChunk, onUploadProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const parser = createSSEParser(onChunk)
    let offset = 0
    let settled = false
    const settle = (error) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', cancel)
      if (error) reject(error)
      else resolve()
    }
    const cancel = () => { settle(abortError()); xhr.abort() }
    const isStream = () => xhr.status >= 200 && xhr.status < 300 && (xhr.getResponseHeader('Content-Type') || '').includes('text/event-stream')
    const consume = () => {
      if (settled || !isStream()) return
      parser.push(xhr.responseText.slice(offset))
      offset = xhr.responseText.length
    }
    xhr.open('POST', url)
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value)
    xhr.upload.onprogress = (event) => reportUpload(event, onUploadProgress)
    xhr.upload.onload = () => onUploadProgress?.({ phase: 'processing', percent: 100 })
    xhr.onprogress = () => {
      try { consume() } catch (error) { settle(error); xhr.abort() }
    }
    xhr.onload = () => {
      if (settled) return
      try {
        if (!isStream()) throw responseError(xhr.responseText, xhr.status)
        consume()
        parser.finish()
        settle()
      } catch (error) { settle(error) }
    }
    xhr.onerror = () => settle(new Error('Network error. Please check your connection and try again.'))
    xhr.onabort = () => settle(abortError())
    xhr.ontimeout = () => settle(new Error('Request timed out. Please try again.'))
    signal?.addEventListener('abort', cancel, { once: true })
    if (signal?.aborted) return cancel()
    try { xhr.send(formData) } catch (error) { settle(error) }
  })
}

export async function streamCreation({ path, data, prompt, length, formData, getToken, token, signal, onChunk, onUploadProgress, baseUrl = baseURL }) {
  try {
    const authorization = await authHeaders({ getToken, token, signal })
    const headers = { Accept: 'text/event-stream', ...authorization }
    const url = `${baseUrl}${path}`
    if (formData && onUploadProgress) {
      return await uploadStream({ url, headers, formData, signal, onChunk, onUploadProgress })
    }
    const response = await fetch(url, {
      method: 'POST', signal,
      headers: { ...headers, ...(formData ? {} : { 'Content-Type': 'application/json' }) },
      body: formData ?? JSON.stringify(data ?? (length === undefined ? { prompt } : { prompt, length })),
    })
    if (!response.ok || !(response.headers.get('content-type') || '').includes('text/event-stream')) {
      throw responseError(await response.text(), response.status)
    }
    if (!response.body) throw new Error('Streaming is unavailable in this browser.')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const parser = createSSEParser(onChunk)
    let finished = false
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        parser.push(decoder.decode(value, { stream: true }))
      }
      parser.push(decoder.decode())
      parser.finish()
      finished = true
    } finally {
      if (!finished) { try { await reader.cancel() } catch { /* Already disconnected. */ } }
      reader.releaseLock()
    }
  } catch (error) { throw toApiError(error) }
}
