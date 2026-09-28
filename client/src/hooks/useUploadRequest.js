import { useEffect, useRef, useState } from 'react'
import { useCancelableRequest } from './useCancelableRequest'

export function useUploadRequest(options) {
  const [progress, setProgress] = useState({ phase: 'idle', percent: null })
  const request = useCancelableRequest(options)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const run = async (operation) => {
    const result = await request.run(async ({ signal }) => {
      if (mounted.current) setProgress({ phase: 'preparing', percent: null })
      return operation({
        signal,
        onUploadProgress: (value) => { if (mounted.current && !signal.aborted) setProgress(value) },
      })
    })
    if (mounted.current) {
      if (result.status === 'complete') setProgress({ phase: 'done', percent: 100 })
      if (result.status === 'error' || result.status === 'stopped') setProgress({ phase: 'error', percent: null })
    }
    return result
  }
  return { ...request, progress, run, cancel: request.stop }
}
