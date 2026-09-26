import { FileText, Sparkles } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { streamCreation } from '../utils/streamCreation'
import { useAuth } from '@clerk/clerk-react';
import Markdown from 'react-markdown';



const ReviewResume = () => {

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')

  const {getToken} = useAuth()

  const abortRef = useRef(null)
  const outputRef = useRef(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => () => abortRef.current?.abort(), [])
  useLayoutEffect(() => {
    if (loading && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [content, loading])

  const onSubmitHandler = async (e) => {
    e.preventDefault()
    if (abortRef.current) return
    if (!input || input.size > 5 * 1024 * 1024) {
      toast.error('Please upload a PDF resume no larger than 5MB.')
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setContent('')
    setErrorMessage('')
    try {
      const formData = new FormData()
      formData.append('resume', input)
      await streamCreation({
        path: '/api/ai/resume-review',
        formData,
        token: await getToken(),
        signal: controller.signal,
        onChunk: (text) => setContent((current) => current + text),
      })
    } catch (error) {
      if (error.name === 'AbortError') {
        setErrorMessage('Review stopped. Partial results may be incomplete.')
      } else {
        setErrorMessage(error.message)
        toast.error(error.message)
      }
    } finally {
      abortRef.current = null
      setLoading(false)
    }
  }

  return (
    <div className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700'>
      {/* left col */}
      <form onSubmit={onSubmitHandler} className='w-full max-w-lg p-4 bg-white rounded-lg border border-gray-200'>
        <div className='flex items-center gap-3'>
          <Sparkles className='w-6 text-[#00DA83]' />
          <h1 className='text-xl font-semibold'>Resume Review</h1>
        </div>
        <p className='mt-6 text-sm font-medium'>Upload Resume</p>
        <input onChange={(e)=>setInput(e.target.files[0])}  type="file" accept='application/pdf' className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300 text-gray-600 cursor-pointer file:cursor-pointer hover:border-gray-400 transition-colors' placeholder='The future of artificial intelligence' required/>

        <p className='text-xs text-gray-500 font-light mt-1'>Supports PDF resume only (up to 5MB).</p>

        <button disabled={loading} className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#00DA83] to-[#009BB3] text-white px-4 py-2 mt-6 text-sm rounded-lg cursor-pointer'>
          {loading ? <span className='w-4 h-4 my-1 rounded-full border-2 border-t-transparent animate-spin'></span>:<FileText className='w-5'/>}
          {loading ? 'Analyzing...' : 'Review Resume'}
        </button>
        {loading && (
          <button type='button' onClick={() => abortRef.current?.abort()} className='mt-3 w-full rounded-lg border border-gray-300 py-2 text-sm'>
            Stop generating
          </button>
        )}
      </form>
      {/* right col */}
      <div className='w-full max-w-lg p-4 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96 max-h-[600px]'>
          <div className='flex items-center gap-3'>
            <FileText className='w-5 h-5 text-[#00DA83]'/>
            <h1 className='text-xl font-semibold'>Analysis Results</h1>
          </div>
          {errorMessage && <p role='alert' className='mt-3 text-sm text-red-600'>{errorMessage}</p>}
          {
            !content ? 
            (
            <div className='flex-1 flex justify-center items-center'>
              <div className='text-sm flex flex-col items-center gap-5 text-gray-400'>
                <FileText className='w-9 h-9'/>
                <p>{loading ? 'Reading your resume and preparing feedback...' : 'Upload your resume and click "Review Resume" to get started'}</p>
              </div>
            </div>):
            (
              <div ref={outputRef} className='mt-3 flex-1 min-h-0 overflow-y-auto text-sm text-slate-600'>
                <div className='reset-tw'>
                  <Markdown>{content}</Markdown>
                </div>
              </div>
            )
          }
          
      </div>
    </div>
  )
}

export default ReviewResume