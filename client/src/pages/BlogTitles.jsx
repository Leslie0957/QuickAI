import { useAuth } from '@clerk/clerk-react'
import { Hash, Sparkles } from 'lucide-react'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

import toast from 'react-hot-toast'
import Markdown from 'react-markdown'
import { streamCreation } from '../utils/streamCreation'

const BlogTitles = () => {

  const blogCategories = ['General', 'Technology', 'Business', 'Health', 'Lifestyle', 'Education', 'Travel', 'Food']

  const [selectedCategory, setSelectedCategory] = useState('General')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const abortRef = useRef(null)
  const outputRef = useRef(null)

  useEffect(() => () => abortRef.current?.abort(), [])
  useLayoutEffect(() => {
    if (loading && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [content, loading])

  const { getToken } = useAuth()

  const onSubmitHandler = async (e) => {
    e.preventDefault()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setContent('')
    try {
      const prompt = `Generate 5 concise blog titles for the keyword "${input}" in the ${selectedCategory} category. Return only a numbered list, without an introduction or bold formatting.`
      await streamCreation({
        path: '/api/ai/generate-blog-title',
        prompt,
        token: await getToken(),
        signal: controller.signal,
        onChunk: (text) => setContent((current) => current + text),
      })
    } catch (error) {
      if (error.name !== 'AbortError') {
        setContent('')
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
          <Sparkles className='w-6 text-[#8E37EB]' />
          <h1 className='text-xl font-semibold'>AI Title Generator</h1>
        </div>
        <p className='mt-6 text-sm font-medium'>Keyword</p>
        <input onChange={(e) => setInput(e.target.value)} value={input} type="text" className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300' placeholder='The future of artificial intelligence' required />

        <p className='mt-4 text-sm font-medium'>Category</p>
        <div className='mt-3 flex gap-3 flex-wrap sm:max-w-9/11'>
          {blogCategories.map((item) => (
            <span onClick={() => setSelectedCategory(item)}
              className={`text-xs px-4 py-1 border rounded-full cursor-pointer ${selectedCategory === item ? 'bg-purple-50 text-purple-700' : 'text-gray-500 border-gray-300'}`}
              key={item}>{item}</span>
          ))}
        </div>
        <br />
        <button disabled={loading} className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#C341F6] to-[#8E37EB] text-white px-4 py-2 mt-6 text-sm rounded-lg cursor-pointer'>
          {loading ? <span className='w-4 h-4 my-1 rounded-full border-2 border-t-transparent animate-spin'></span> : <Hash className='w-5' />}
          Generate title
        </button>
      </form>
      {/* right col */}
      <div className='w-full max-w-lg p-4 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96 max-h-[600px]'>
        <div className='flex items-center gap-3'>
          <Hash className='w-5 h-5 text-[#8E37EB]' />
          <h1 className='text-xl font-semibold'>Generated titles</h1>
        </div>
        {
          !content ? (
            <div className='flex-1 flex justify-center items-center'>
              <div className='text-sm flex flex-col items-center gap-5 text-gray-400'>
                <Hash className='w-9 h-9' />
                <p>Enter keywords and click "Generate title" to get started</p>
              </div>
            </div>
          ) : (
            <div ref={outputRef} className='mt-3 flex-1 min-h-0 overflow-y-auto text-sm text-slate-600'>
              <div className='reset-tw'><Markdown>{content}</Markdown></div>
            </div>
          )
        }

      </div>
    </div>
  )
}

export default BlogTitles