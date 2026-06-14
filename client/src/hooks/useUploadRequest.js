import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

export function useUploadRequest() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ phase: 'idle', percent: null })
  const [errorMessage, setErrorMessage] = useState('')
  const abortRef = useRef(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; abortRef.current?.abort() }
  }, [])
  const run = async (operation) => {
    if (abortRef.current) return
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setErrorMessage('')
    setProgress({ phase: 'preparing', percent: null })
    try {
      await operation({
        signal: controller.signal,
        onUploadProgress: (value) => { if (mounted.current) setProgress(value) },
      })
      if (mounted.current) setProgress({ phase: 'done', percent: 100 })
    } catch (error) {
      if (mounted.current) {
        const message = error.name === 'AbortError' ? 'Request stopped. Partial results may be incomplete.' : error.message
        setErrorMessage(message)
        setProgress({ phase: 'error', percent: null })
        if (error.name !== 'AbortError') toast.error(message)
      }
    } finally {
      abortRef.current = null
      if (mounted.current) setLoading(false)
    }
  }
  return { loading, progress, errorMessage, run, cancel: () => abortRef.current?.abort() }
}
