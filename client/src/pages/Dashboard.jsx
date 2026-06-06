import React, { useEffect, useRef, useState } from 'react'
import { Gem, Sparkles } from 'lucide-react'
import { Protect, useAuth } from '@clerk/clerk-react'
import CreationItem from '../components/CreationItem'
import axios from 'axios'
import toast from 'react-hot-toast'

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL

let dashboardCache = null

const Dashboard = () => {
  
  const { getToken, userId } = useAuth()
  const getTokenRef = useRef(getToken)
  useEffect(() => { getTokenRef.current = getToken }, [getToken])
  const cachedCreations = dashboardCache?.userId === userId ? dashboardCache.creations : null
  const [creations, setCreations] = useState(cachedCreations ?? [])
  const [loading, setLoading] = useState(!cachedCreations)

  useEffect(() => {
    if (!userId) return
    let active = true

    const getDashboardData = async () => {
      try {
        const { data } = await axios.get('/api/user/get-user-creations', {
          headers: { Authorization: `Bearer ${await getTokenRef.current()}` }
        })
        if (!active) return
        if (data.success) {
          dashboardCache = { userId, creations: data.creations }
          setCreations(data.creations)
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        if (active) toast.error(error.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    getDashboardData()
    return () => { active = false }
  }, [userId])

  const onPublishChange = async (item) => {
    try {
      const { data } = await axios.post('/api/user/set-creation-publish',
        { id: item.id, publish: !item.publish },
        { headers: { Authorization: `Bearer ${await getTokenRef.current()}` } }
      )
      if (!data.success) throw new Error(data.message)

      setCreations((current) => {
        const updated = current.map((creation) =>
          creation.id === item.id ? { ...creation, publish: data.creation.publish } : creation
        )
        dashboardCache = { userId, creations: updated }
        return updated
      })
      toast.success(data.creation.publish ? 'Shared to Community' : 'Removed from Community')
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  return (
    <div className='h-full overflow-y-scroll p-6'>
      <div className='flex justify-start gap-4 flex-wrap'>
        {/* Total Creations Card */}
        <div className='flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200'>
          <div className='text-slate-600'>
            <p className='text-sm'>Total Creations</p>
            <h2 className='text-xl font-semibold'>{loading ? '...' : creations.length}</h2>
          </div>
          <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-[#3588F2] to-[#0bb0d7] text-white flex justify-center items-center'>
            <Sparkles className='w-5 text-white'/>
          </div>
        </div>

        {/* Active Plan Card */}
        <div className='flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200'>
          <div className='text-slate-600'>
            <p className='text-sm'>Active Plan</p>
            <h2 className='text-xl font-semibold'>
              <Protect plan='premium' fallback="Free">Premium</Protect>
            </h2>
          </div>
          <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF61C5] to-[#9E53EE] text-white flex justify-center items-center'>
            <Gem className='w-5 text-white'/>
          </div>
        </div>
      </div>

      {
        loading ?
        (
          <div className='flex justify-center items-center h-3/4'>
            <div className='animate-spin rounded-full h-11 w-11 border-3 border-purple-500 border-t-transparent'></div>
          </div>
        )
        :
        (
        <div className='space-y-3'>
          <p className='mt-6 mb-4'>Recent Creations</p>
          {
            creations.map((item)=> <CreationItem key={item.id} item={item} onPublishChange={onPublishChange}/>)
          }
        </div>
        )
      }
    </div>
  )
}

export default Dashboard