const dashboardEntries = new Map()
const communityEntries = new Map()
const listeners = new Set()

const notify = () => {
  for (const listener of listeners) listener()
}

export const subscribeCreationCache = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getDashboardEntry = (userId) => userId ? dashboardEntries.get(userId) ?? null : null
export const getCommunityEntry = (userId) => userId ? communityEntries.get(userId) ?? null : null

export const setDashboardEntry = (userId, creations) => {
  if (!userId) return
  dashboardEntries.set(userId, { creations })
  notify()
}

export const updateDashboardCreation = (userId, id, patch) => {
  const entry = getDashboardEntry(userId)
  if (!entry) return
  setDashboardEntry(userId, entry.creations.map((creation) =>
    creation.id === id ? { ...creation, ...patch } : creation
  ))
}

export const setCommunityEntry = (userId, entry) => {
  if (!userId) return
  communityEntries.set(userId, entry)
  notify()
}

export const updateCommunityCreation = (userId, id, patch) => {
  const entry = getCommunityEntry(userId)
  if (!entry) return
  setCommunityEntry(userId, {
    ...entry,
    creations: entry.creations.map((creation) =>
      creation.id === id ? { ...creation, ...patch } : creation
    ),
  })
}

export const reflectPublishedImage = (userId, creation, publish, author) => {
  const entry = getCommunityEntry(userId)
  if (!entry) return
  const withoutImage = entry.creations.filter((item) => item.id !== creation.id)
  setCommunityEntry(userId, {
    ...entry,
    creations: publish
      ? [{
          id: creation.id,
          user_id: userId,
          prompt: creation.prompt,
          content: creation.content,
          created_at: creation.created_at,
          like_count: creation.likes?.length ?? 0,
          liked_by_me: creation.likes?.includes(userId) ?? false,
          author_name: author.name,
          author_image_url: author.imageUrl,
        }, ...withoutImage].sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at) || (BigInt(b.id) > BigInt(a.id) ? 1 : -1)
        )
      : withoutImage,
  })
}