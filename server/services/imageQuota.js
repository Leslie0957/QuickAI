import sql from '../configs/db.js'

export const DAILY_IMAGE_LIMIT = 10

export const currentQuotaDay = () => new Date().toISOString().slice(0, 10)

export async function getRemainingImages(userId, day = currentQuotaDay()) {
    const [quota] = await sql`
        SELECT used FROM image_generation_quota
        WHERE user_id = ${userId} AND quota_day = ${day}::date
    `
    return DAILY_IMAGE_LIMIT - (quota?.used ?? 0)
}

export async function reserveImage(userId, day = currentQuotaDay()) {
    const [quota] = await sql`
        INSERT INTO image_generation_quota (user_id, quota_day, used)
        VALUES (${userId}, ${day}::date, 1)
        ON CONFLICT (user_id, quota_day)
        DO UPDATE SET used = image_generation_quota.used + 1
        WHERE image_generation_quota.used < ${DAILY_IMAGE_LIMIT}
        RETURNING used
    `
    return quota ? DAILY_IMAGE_LIMIT - quota.used : null
}

export async function releaseImage(userId, day) {
    await sql`
        UPDATE image_generation_quota
        SET used = GREATEST(used - 1, 0)
        WHERE user_id = ${userId} AND quota_day = ${day}::date
    `
}
