import { clerkClient } from '@clerk/express'
import sql from '../configs/db.js'

const profileFromUser = (user) => ({
    userId: user.id,
    name: user.fullName || user.username || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member',
    imageUrl: user.imageUrl || null,
})

const saveProfiles = async (profiles) => {
    if (profiles.length === 0) return
    const ids = profiles.map((profile) => profile.userId)
    const names = profiles.map((profile) => profile.name)
    const images = profiles.map((profile) => profile.imageUrl)
    await sql`
        INSERT INTO public_profiles (user_id, display_name, image_url)
        SELECT * FROM unnest(${ids}::text[], ${names}::text[], ${images}::text[])
        ON CONFLICT (user_id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            image_url = EXCLUDED.image_url,
            updated_at = now()
    `
}

export const syncPublicProfile = async (userId) => {
    try {
        const user = await clerkClient.users.getUser(userId)
        await saveProfiles([profileFromUser(user)])
    } catch (error) {
        // The image can still be published; the feed will retry missing profiles later.
        console.error('Could not sync public profile:', error.message)
    }
}

export const fillMissingProfiles = async (rows) => {
    const missingIds = [...new Set(rows.filter((row) => !row.profile_user_id).map((row) => row.user_id))]
    if (missingIds.length === 0) return rows

    try {
        // One Clerk request for the page, never one request per image.
        const { data: users } = await clerkClient.users.getUserList({ userId: missingIds, limit: missingIds.length })
        const profiles = users.map(profileFromUser)
        await saveProfiles(profiles)
        const byId = new Map(profiles.map((profile) => [profile.userId, profile]))
        return rows.map((row) => {
            const profile = byId.get(row.user_id)
            return profile ? { ...row, author_name: profile.name, author_image_url: profile.imageUrl } : row
        })
    } catch (error) {
        console.error('Could not load public profiles:', error.message)
        return rows
    }
}