import { request, reportUpload } from './http.js'
import { streamCreation } from './stream.js'

export const generateArticle = ({ topic, length, lengthLabel, ...options }) => streamCreation({
  ...options, path: '/api/ai/generate-article',
  data: {
    prompt: `Write an article about ${topic}. Target length: ${lengthLabel}. Use the same language as the topic unless the topic explicitly requests another language. Format the article as Markdown with a title, section headings, readable paragraphs, and lists where appropriate. Output only the article. Do not wrap it in a code block or add commentary before or after it.`,
    length,
  },
})
export const continueArticle = ({ topic, length, lengthLabel, previousContent, ...options }) => streamCreation({
  ...options, path: '/api/ai/continue-article',
  data: { topic, length, lengthLabel, previousContent },
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
