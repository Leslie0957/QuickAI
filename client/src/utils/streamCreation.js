export async function streamCreation({ path, prompt, length, token, signal, onChunk, baseUrl = import.meta.env.VITE_BASE_URL }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(length === undefined ? { prompt } : { prompt, length }),
    signal,
  })

  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || !contentType.includes('text/event-stream')) {
    const data = contentType.includes('application/json')
      ? await response.json()
      : null
    throw new Error(data?.message || `Generation failed (HTTP ${response.status}).`)
  }
  if (!response.body) throw new Error('Streaming is unavailable in this browser.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed = false

  const processEvent = (raw) => {
    const lines = raw.split('\n')
    const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
    const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
    if (!type || !data) return
    const payload = JSON.parse(data)
    if (type === 'chunk') onChunk(payload.text)
    if (type === 'error') throw new Error(payload.message || 'Generation failed.')
    if (type === 'done') completed = true
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let end
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        processEvent(buffer.slice(0, end))
        buffer = buffer.slice(end + 2)
      }
    }
    buffer += decoder.decode()
    if (buffer.trim()) processEvent(buffer)
    if (!completed) throw new Error('Generation stopped before completion. Please try again.')
  } finally {
    if (!completed) {
      try { await reader.cancel() } catch { /* connection already closed */ }
    }
    reader.releaseLock()
  }
}
