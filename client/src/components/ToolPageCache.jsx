import { createElement, useLayoutEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import WriteArticle from '../pages/WriteArticle'
import BlogTitles from '../pages/BlogTitles'
import GenerateImages from '../pages/GenerateImages'
import RemoveBackground from '../pages/RemoveBackground'
import RemoveObject from '../pages/RemoveObject'
import ReviewResume from '../pages/ReviewResume'

const tools = [
  ['/ai/write-article', WriteArticle],
  ['/ai/blog-titles', BlogTitles],
  ['/ai/generate-images', GenerateImages],
  ['/ai/remove-background', RemoveBackground],
  ['/ai/remove-object', RemoveObject],
  ['/ai/review-resume', ReviewResume],
]

const ToolPageCache = () => {
  const { pathname } = useLocation()
  const [visited, setVisited] = useState(() => new Set([pathname]))

  useLayoutEffect(() => {
    if (tools.some(([path]) => path === pathname)) {
      setVisited((previous) => previous.has(pathname) ? previous : new Set([...previous, pathname]))
    }
  }, [pathname])

  return tools.map(([path, Component]) => visited.has(path) && (
    <div key={path} className={pathname === path ? 'h-full' : 'hidden'}>
      {createElement(Component)}
    </div>
  ))
}

export default ToolPageCache
