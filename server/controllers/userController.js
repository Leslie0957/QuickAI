import sql from '../configs/db.js'
import { fillMissingProfiles, syncPublicProfile } from '../services/publicProfiles.js'

const COMMUNITY_PAGE_SIZE = 12
const isValidId = (id) => typeof id === 'string' && /^[1-9][0-9]{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n

const decodeCursor = (value) => {
    if (typeof value !== 'string' || value.length > 256) return null
    try {
        const [createdAt, id] = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
        if (typeof createdAt !== 'string' || !isValidId(id) || Number.isNaN(Date.parse(createdAt))) return null
        return { createdAt, id }
    } catch {
        return null
    }
}

const encodeCursor = (row) => Buffer.from(JSON.stringify([new Date(row.created_at).toISOString(), row.id])).toString('base64url')

export const getUserCreations = async (req, res) => {
    try {
        const { userId } = req.auth()
        const creations = await sql`SELECT * FROM creations WHERE user_id = ${userId} ORDER BY created_at DESC`
        res.json({ success: true, creations })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const getPublishedCreations = async (req, res) => {
    try {
        const { userId } = req.auth()
        const cursor = req.query.cursor === undefined ? null : decodeCursor(req.query.cursor)
        if (req.query.cursor !== undefined && !cursor) {
            return res.status(400).json({ success: false, message: 'Invalid page cursor.' })
        }

        const rows = cursor
            ? await sql`
                SELECT c.id, c.user_id, c.prompt, c.content, c.created_at,
                    COALESCE(cardinality(c.likes), 0) AS like_count,
                    ${userId} = ANY(COALESCE(c.likes, ARRAY[]::text[])) AS liked_by_me,
                    p.user_id AS profile_user_id, p.display_name AS author_name, p.image_url AS author_image_url
                FROM creations c LEFT JOIN public_profiles p ON p.user_id = c.user_id
                WHERE c.publish = true AND c.type = 'image'
                    AND (c.created_at, c.id) < (${cursor.createdAt}, ${cursor.id})
                ORDER BY c.created_at DESC, c.id DESC
                LIMIT ${COMMUNITY_PAGE_SIZE + 1}
            `
            : await sql`
                SELECT c.id, c.user_id, c.prompt, c.content, c.created_at,
                    COALESCE(cardinality(c.likes), 0) AS like_count,
                    ${userId} = ANY(COALESCE(c.likes, ARRAY[]::text[])) AS liked_by_me,
                    p.user_id AS profile_user_id, p.display_name AS author_name, p.image_url AS author_image_url
                FROM creations c LEFT JOIN public_profiles p ON p.user_id = c.user_id
                WHERE c.publish = true AND c.type = 'image'
                ORDER BY c.created_at DESC, c.id DESC
                LIMIT ${COMMUNITY_PAGE_SIZE + 1}
            `

        const hasMore = rows.length > COMMUNITY_PAGE_SIZE
        const page = await fillMissingProfiles(rows.slice(0, COMMUNITY_PAGE_SIZE))
        const creations = page.map(({ profile_user_id, ...creation }) => ({
            ...creation,
            author_name: creation.author_name || 'Member',
            author_image_url: creation.author_image_url || null,
        }))
        res.json({ success: true, creations, nextCursor: hasMore ? encodeCursor(page.at(-1)) : null })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const toggleLikeCreation = async (req, res) => {
    try {
        const { userId } = req.auth()
        const id = String(req.body?.id ?? '')
        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid image ID.' })
        }

        // A single row update makes concurrent likes atomic and only allows public images.
        const [creation] = await sql`
            UPDATE creations
            SET likes = CASE
                WHEN ${userId} = ANY(COALESCE(likes, ARRAY[]::text[]))
                    THEN array_remove(COALESCE(likes, ARRAY[]::text[]), ${userId})
                ELSE array_append(COALESCE(likes, ARRAY[]::text[]), ${userId})
            END
            WHERE id = ${id} AND publish = true AND type = 'image'
            RETURNING id, cardinality(likes) AS like_count, ${userId} = ANY(likes) AS liked_by_me
        `
        if (!creation) return res.status(404).json({ success: false, message: 'Public image not found.' })
        res.json({ success: true, creation })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const setCreationPublish = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { id, publish } = req.body
        const creationId = String(id ?? '')
        if (!isValidId(creationId) || typeof publish !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Invalid publish request.' })
        }

        const [creation] = await sql`
            UPDATE creations SET publish = ${publish}
            WHERE id = ${creationId} AND user_id = ${userId} AND type = 'image'
            RETURNING id, publish
        `
        if (!creation) return res.status(404).json({ success: false, message: 'Image not found.' })
        if (publish) await syncPublicProfile(userId)
        res.json({ success: true, creation })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}