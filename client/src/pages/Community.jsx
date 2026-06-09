import { useAuth, useUser } from '@clerk/clerk-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Heart, UserRound } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  getCommunityEntry, setCommunityEntry, subscribeCreationCache, updateCommunityCreation,
} from '../utils/creationCache'

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL

const Community = () => {
  const { user } = useUser()
  const userId = user?.id
  const { getToken } = useAuth()
  const getTokenRef = useRef(getToken)
  useEffect(() => { getTokenRef.current = getToken }, [getToken])
  const entry = useSyncExternalStore(subscribeCreationCache, () => getCommunityEntry(userId))
  const creations = entry?.creations ?? []
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [pendingLikes, setPendingLikes] = useState(() => new Set())
  const pendingLikesRef = useRef(new Set())
  const mutationVersion = useRef(0)

  useEffect(() => {
    if (!userId) return
    let active = true
    const requestVersion = mutationVersion.current
    const fetchFirstPage = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const { data } = await axios.get('/api/user/get-published-creations', {
          headers: { Authorization: `Bearer ${await getTokenRef.current()}` },
        })
        if (!data.success) throw new Error(data.message || 'Could not load public images.')
        if (active && requestVersion === mutationVersion.current) {
          setCommunityEntry(userId, { creations: data.creations, nextCursor: data.nextCursor })
        }
      } catch (error) {
        if (active) setLoadError(error.response?.data?.message || error.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchFirstPage()
    return () => { active = false }
  }, [userId, retry])

  const loadMore = async () => {
    const cursor = entry?.nextCursor
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    setLoadError('')
    try {
      const { data } = await axios.get('/api/user/get-published-creations', {
        params: { cursor },
        headers: { Authorization: `Bearer ${await getTokenRef.current()}` },
      })
      if (!data.success) throw new Error(data.message || 'Could not load more images.')
      const current = getCommunityEntry(userId)
      if (current?.nextCursor !== cursor) return
      const existingIds = new Set(current.creations.map((item) => item.id))
      setCommunityEntry(userId, {
        creations: [...current.creations, ...data.creations.filter((item) => !existingIds.has(item.id))],
        nextCursor: data.nextCursor,
      })
    } catch (error) {
      setLoadError(error.response?.data?.message || error.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const toggleLike = async (id) => {
    if (pendingLikesRef.current.has(id)) return
    const creation = getCommunityEntry(userId)?.creations.find((item) => item.id === id)
    if (!creation) return
    pendingLikesRef.current.add(id)
    setPendingLikes(new Set(pendingLikesRef.current))
    mutationVersion.current += 1
    updateCommunityCreation(userId, id, {
      liked_by_me: !creation.liked_by_me,
      like_count: Math.max(0, creation.like_count + (creation.liked_by_me ? -1 : 1)),
    })
    try {
      const { data } = await axios.post('/api/user/toggle-like-creation', { id }, {
        headers: { Authorization: `Bearer ${await getTokenRef.current()}` },
      })
      if (!data.success) throw new Error(data.message || 'Could not update like.')
      updateCommunityCreation(userId, id, {
        liked_by_me: data.creation.liked_by_me,
        like_count: data.creation.like_count,
      })
    } catch (error) {
      updateCommunityCreation(userId, id, {
        liked_by_me: creation.liked_by_me,
        like_count: creation.like_count,
      })
      toast.error(error.response?.data?.message || error.message)
    } finally {
      pendingLikesRef.current.delete(id)
      setPendingLikes(new Set(pendingLikesRef.current))
    }
  }

  return (
    <div className='flex-1 h-full min-w-0 flex flex-col gap-4 p-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-semibold text-slate-800'>Community creations</h1>
        {entry && loading && <span className='text-xs text-slate-500'>Updating...</span>}
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto rounded-xl bg-white p-4'>
        {loadError && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
            Could not load public images: {loadError}
            <button type='button' className='ml-3 underline' onClick={() => setRetry((value) => value + 1)}>Retry</button>
          </div>
        )}
        {!entry && loading ? (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3' aria-label='Loading public images'>
            {[1, 2, 3].map((item) => <div key={item} className='aspect-square animate-pulse rounded-xl bg-slate-100' />)}
          </div>
        ) : creations.length === 0 && !loadError ? (
          <div className='flex h-full items-center justify-center px-4 text-center text-sm text-gray-500'>
            No public images yet. Share an image from Dashboard or choose “Make this image Public” when generating one.
          </div>
        ) : (
          <>
            <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3'>
              {creations.map((creation) => (
                <article key={creation.id} className='overflow-hidden rounded-xl border border-gray-200 bg-white'>
                  <img
                    src={creation.content}
                    alt={creation.prompt || 'Community image'}
                    loading='lazy'
                    decoding='async'
                    className='aspect-square w-full object-cover'
                  />
                  <div className='flex items-center justify-between gap-3 p-3'>
                    <div className='flex min-w-0 items-center gap-2'>
                      {creation.author_image_url
                        ? <img src={creation.author_image_url} alt='' loading='lazy' className='h-9 w-9 shrink-0 rounded-full object-cover' />
                        : <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500'><UserRound className='h-5 w-5' /></span>}
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-medium text-slate-800'>{creation.author_name || 'Member'}</p>
                        <p className='text-xs text-slate-500'>{new Date(creation.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button
                      type='button'
                      onClick={() => toggleLike(creation.id)}
                      disabled={pendingLikes.has(creation.id)}
                      aria-label={creation.liked_by_me ? 'Unlike image' : 'Like image'}
                      aria-pressed={Boolean(creation.liked_by_me)}
                      className='flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50'
                    >
                      <span>{creation.like_count}</span>
                      <Heart className={`h-5 w-5 ${creation.liked_by_me ? 'fill-red-500 text-red-600' : 'text-slate-600'}`} />
                    </button>
                  </div>
                  <p className='px-3 pb-3 text-sm text-slate-600 line-clamp-2' title={creation.prompt}>{creation.prompt}</p>
                </article>
              ))}
            </div>
            {entry?.nextCursor && (
              <div className='mt-6 flex justify-center'>
                <button type='button' onClick={loadMore} disabled={loadingMore}
                  className='rounded-lg border border-gray-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50'>
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Community