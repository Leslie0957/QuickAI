import { request, reportUpload } from './http.js'
import { streamCreation } from './stream.js'

export const generateArticle = ({ topic, length, lengthLabel, ...options }) => streamCreation({
  ...options, path: '/api/ai/generate-article',
  data: { prompt: `Write an article about ${topic}. Target length: ${lengthLabel}.`, length },
})
export const generateBlogTitles = ({ keyword, category, ...options }) => streamCreation({
  ...options, path: '/api/ai/generate-blog-title',
  data: { prompt: `Generate 5 concise blog titles for the keyword "${keyword}" in the ${category} category. Return only a numbered list, without an introduction or bold formatting.` },
})
export const getImageQuota = (options) => request({ ...options, method: 'GET', url: '/api/ai/image-quota' })
export const generateImage = ({ description, style, publish, ...options }) => request({
  ...options, method: 'POST', url: '/api/ai/generate-image',
  data: { prompt: `Generate an image of ${description.trim()} in the style ${style}`, publish },
})
function imageUpload(path, { file, object, onUploadProgress, ...options }) {
  const data = new FormData()
  data.append('image', file)
  if (object !== undefined) data.append('object', object)
  return request({ ...options, method: 'POST', url: path, data, adapter: 'xhr',
    onUploadProgress: (event) => reportUpload(event, onUploadProgress),
  })
}
export const removeBackground = (options) => imageUpload('/api/ai/remove-image-background', options)
export const removeObject = (options) => imageUpload('/api/ai/remove-image-object', options)
export const reviewResume = ({ file, ...options }) => {
  const formData = new FormData()
  formData.append('resume', file)
  return streamCreation({ ...options, path: '/api/ai/resume-review', formData })
}
