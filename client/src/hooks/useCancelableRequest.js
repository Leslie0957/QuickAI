import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

export function useCancelableRequest({ stoppedMessage = 'Request stopped. Partial results may be incomplete.' } = {}) {
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const controllerRef = useRef(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controllerRef.current?.abort()
    }
  }, [])

  const stop = () => {
    if (controllerRef.current && !controllerRef.current.signal.aborted) {
      controllerRef.current.abort()
      if (mounted.current) setStatus('stopping')
    }
  }

  const run = async (operation) => {
    if (controllerRef.current) return { status: 'busy' }
    const controller = new AbortController()
    controllerRef.current = controller
    if (mounted.current) {
      setStatus('running')
      setErrorMessage('')
    }
    try {
      const value = await operation({ signal: controller.signal })
      if (controller.signal.aborted) throw new DOMException('Request cancelled.', 'AbortError')
      if (mounted.current) setStatus('complete')
      return { status: 'complete', value }
    } catch (error) {
      const stopped = controller.signal.aborted || error?.name === 'AbortError'
      const message = stopped ? stoppedMessage : error?.message || 'Request failed. Please try again.'
      if (mounted.current) {
        setStatus(stopped ? 'stopped' : 'error')
        setErrorMessage(message)
        if (!stopped) toast.error(message)
      }
      return { status: stopped ? 'stopped' : 'error', error }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }

  return { loading: status === 'running' || status === 'stopping', stopping: status === 'stopping', status, errorMessage, run, stop }
}
