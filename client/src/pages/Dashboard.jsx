import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Gem, Sparkles } from 'lucide-react'
import { Protect, useAuth, useUser } from '@clerk/clerk-react'
import CreationItem from '../components/CreationItem'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  getDashboardEntry, reflectPublishedImage, setDashboardEntry,
  subscribeCreationCache, updateDashboardCreation,
} from '../utils/creationCache'

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL

const Dashboard = () => {
  const { getToken } = useAuth()
  const { user } = useUser()
  const userId = user?.id
  const getTokenRef = useRef(getToken)
  useEffect(() => { getTokenRef.current = getToken }, [getToken])
  const entry = useSyncExternalStore(subscribeCreationCache, () => getDashboardEntry(userId))
  const creations = entry?.creations ?? []
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!userId) return
    let active = true
    const getDashboardData = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const { data } = await axios.get('/api/user/get-user-creations', {
          headers: { Authorization: `Bearer ${await getTokenRef.current()}` },
        })
        if (!data.success) throw new Error(data.message || 'Could not load creations.')
        if (active) setDashboardEntry(userId, data.creations)
      } catch (error) {
        if (active) setLoadError(error.response?.data?.message || error.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    getDashboardData()
    return () => { active = false }
  }, [userId, retry])

  const onPublishChange = async (item) => {
    try {
      const { data } = await axios.post('/api/user/set-creation-publish',
        { id: item.id, publish: !item.publish },
        { headers: { Authorization: `Bearer ${await getTokenRef.current()}` } }
      )
      if (!data.success) throw new Error(data.message)
      updateDashboardCreation(userId, item.id, { publish: data.creation.publish })
      reflectPublishedImage(userId, item, data.creation.publish, {
        name: user.fullName || user.username || 'Member',
        imageUrl: user.imageUrl || null,
      })
      toast.success(data.creation.publish ? 'Shared to Community' : 'Removed from Community')
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  return (
    <div className='h-full overflow-y-scroll p-6'>
      <div className='flex justify-start gap-4 flex-wrap'>
        <div className='flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200'>
          <div className='text-slate-600'>
            <p className='text-sm'>Total Creations</p>
            <h2 className='text-xl font-semibold'>{!entry && loading ? '...' : creations.length}</h2>
          </div>
          <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-[#3588F2] to-[#0bb0d7] text-white flex justify-center items-center'>
            <Sparkles className='w-5 text-white'/>
          </div>
        </div>
        <div className='flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200'>
          <div className='text-slate-600'>
            <p className='text-sm'>Active Plan</p>
            <h2 className='text-xl font-semibold'>
              <Protect plan='premium' fallback='Free'>Premium</Protect>
            </h2>
          </div>
          <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF61C5] to-[#9E53EE] text-white flex justify-center items-center'>
            <Gem className='w-5 text-white'/>
          </div>
        </div>
      </div>

      <div className='space-y-3'>
        <p className='mt-6 mb-4'>Recent Creations</p>
        {loadError && (
          <div className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
            Could not refresh creations: {loadError}
            <button type='button' className='ml-3 underline' onClick={() => setRetry((value) => value + 1)}>Retry</button>
          </div>
        )}
        {!entry && loading ? (
          <div className='space-y-3' aria-label='Loading creations'>
            {[1, 2, 3].map((item) => <div key={item} className='h-20 max-w-5xl animate-pulse rounded-lg bg-white border border-gray-200' />)}
          </div>
        ) : creations.map((item) => <CreationItem key={item.id} item={item} onPublishChange={onPublishChange}/>)}
      </div>
    </div>
  )
}

export default Dashboard