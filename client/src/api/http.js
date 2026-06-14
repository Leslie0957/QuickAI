import axios from 'axios'

export const baseURL = (import.meta.env?.VITE_BASE_URL || '').replace(/\/$/, '')
export const http = axios.create({ baseURL })

export const abortError = () => new DOMException('Request cancelled.', 'AbortError')
export function toApiError(error) {
  if (error?.name === 'AbortError' || axios.isCancel(error)) return abortError()
  const result = new Error(error?.response?.data?.message || error?.message || 'Request failed. Please try again.')
  result.status = error?.response?.status ?? error?.status
  result.data = error?.response?.data ?? error?.data
  return result
}
export async function authHeaders({ getToken, token, signal } = {}) {
  if (signal?.aborted) throw abortError()
  const value = getToken ? await getToken() : token
  if (signal?.aborted) throw abortError()
  if (!value) throw new Error('Please sign in to continue.')
  return { Authorization: `Bearer ${value}` }
}
export function checkResult(data, status) {
  if (data?.success === false) {
    const error = new Error(data.message || 'Request failed. Please try again.')
    error.status = status
    error.data = data
    throw error
  }
  return data
}
export async function request({ getToken, token, signal, ...config }) {
  try {
    const headers = await authHeaders({ getToken, token, signal })
    const response = await http.request({ ...config, signal, headers: { ...config.headers, ...headers } })
    return checkResult(response.data, response.status)
  } catch (error) { throw toApiError(error) }
}

// Percentages come only from browser upload events, never a timer.
export function reportUpload(event, onProgress) {
  const total = event.total
  onProgress?.({
    phase: total && event.loaded >= total ? 'processing' : 'uploading',
    percent: total ? Math.min(100, Math.floor(event.loaded / total * 100)) : null,
  })
}
