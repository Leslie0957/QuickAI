import { FileText, Sparkles } from 'lucide-react';
import React, { useLayoutEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { reviewResume } from '../api/ai'
import { useUploadRequest } from '../hooks/useUploadRequest'
import UploadFeedback from '../components/UploadFeedback'
import { useAuth } from '@clerk/clerk-react';
import Markdown from 'react-markdown';
import FilePicker from '../components/FilePicker'
import StopRequestButton from '../components/StopRequestButton'



const ReviewResume = () => {

  const [input, setInput] = useState('')
  const { loading, stopping, progress, errorMessage, run, cancel } = useUploadRequest()
  const [content, setContent] = useState('')

  const {getToken} = useAuth()

  const outputRef = useRef(null)

  useLayoutEffect(() => {
    if (loading && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [content, loading])

  const onSubmitHandler = async (e) => {
    e.preventDefault()
    if (loading) return
    if (!input || input.size > 5 * 1024 * 1024) {
      toast.error('Please upload a PDF resume no larger than 5MB.')
      return
    }
    await run(async (options) => {
      setContent('')
      await reviewResume({
        file: input, getToken, ...options,
        onChunk: (text) => { if (!options.signal.aborted) setContent((current) => current + text) },
      })
    })
  }

  return (
    <div className='h-full overflow-y-auto p-6 flex items-start flex-wrap gap-4 text-slate-700'>
      {/* left col */}
      <form onSubmit={onSubmitHandler} className='w-full max-w-lg p-4 bg-white rounded-lg border border-gray-200'>
        <div className='flex items-center gap-3'>
          <Sparkles className='w-6 text-[#00DA83]' />
          <h1 className='text-xl font-semibold'>Resume Review</h1>
        </div>
        <p className='mt-6 text-sm font-medium'>Upload Resume</p>
        <FilePicker disabled={loading} label='Upload resume' accept='application/pdf' file={input} onChange={(e)=>setInput(e.target.files[0])} />

        <p className='text-xs text-gray-500 font-light mt-1'>Supports PDF resume only (up to 5MB).</p>

        <button disabled={loading} className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#00DA83] to-[#009BB3] text-white px-4 py-2 mt-6 text-sm rounded-lg cursor-pointer'>
          {loading ? <span className='w-4 h-4 my-1 rounded-full border-2 border-t-transparent animate-spin'></span>:<FileText className='w-5'/>}
          {loading ? (progress.phase === 'processing' ? 'Analyzing...' : 'Uploading...') : errorMessage ? 'Retry' : 'Review Resume'}
        </button>
        {loading && <StopRequestButton onClick={cancel} stopping={stopping} />}
        <UploadFeedback loading={loading} progress={progress} errorMessage={errorMessage} />
      </form>
      {/* right col */}
      <div className='w-full max-w-2xl p-4 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96 max-h-[600px]'>
          <div className='flex items-center gap-3'>
            <FileText className='w-5 h-5 text-[#00DA83]'/>
            <h1 className='text-xl font-semibold'>Analysis Results</h1>
          </div>
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
              <div ref={outputRef} className='mt-3 flex-1 min-h-0 overflow-y-auto break-words text-sm text-slate-600'>
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
