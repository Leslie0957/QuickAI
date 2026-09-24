import React, { useState } from 'react'
import Markdown from 'react-markdown'
const CreationItem = ({ item, onPublishChange }) => {

  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)

  const togglePublish = async (event) => {
    event.stopPropagation()
    setSaving(true)
    try {
      await onPublishChange(item)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={() => setExpanded(!expanded)} className='p-4 max-w-5xl text-sm bg-white border border-gray-200 rounded-lg cursor-pointer'>
      <div className='flex justify-between items-center gap-4'>
        <div>
          <h2>{item.prompt}</h2>
          <p className='text-gray-500'>{item.type} - {new Date(item.created_at).toLocaleDateString()}</p>
        </div>
        <div className='flex items-center gap-2'>
          {item.type === 'image' && (
            <button type='button' onClick={togglePublish} disabled={saving}
              className='rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800 disabled:opacity-50'>
              {saving ? 'Saving...' : item.publish ? 'Remove from Community' : 'Share to Community'}
            </button>
          )}
          <span className='rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-blue-800'>{item.type}</span>
        </div>
      </div>
      {
        expanded && (
          <div>
            {item.type === 'image' ? (
              <div>
                <img src={item.content} alt="image" className='mt-3 w-full max-w-md' />
              </div>
            ) : (
              <div className='mt-3 h-full overflow-y-scroll text-sm text-slate-700'>
                <div className='reset-tw'>
                  <Markdown>{item.content}</Markdown>
                </div>
              </div>
            )}
          </div>
        )
      }
    </div>
  )
}

export default CreationItem