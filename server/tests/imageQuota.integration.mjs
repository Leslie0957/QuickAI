import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import sql from '../configs/db.js'
import { currentQuotaDay, getRemainingImages, releaseImage, reserveImage } from '../services/imageQuota.js'

test('daily image quota blocks concurrent requests after ten reservations and releases failures', async () => {
    const userId = `quota-test-${randomUUID()}`
    const day = currentQuotaDay()
    try {
        assert.equal(await getRemainingImages(userId, day), 10)
        const reservations = await Promise.all(Array.from({ length: 12 }, () => reserveImage(userId, day)))
        assert.equal(reservations.filter((remaining) => remaining !== null).length, 10)
        assert.equal(reservations.filter((remaining) => remaining === null).length, 2)
        assert.equal(await getRemainingImages(userId, day), 0)

        await releaseImage(userId, day)
        assert.equal(await getRemainingImages(userId, day), 1)
        assert.equal(await reserveImage(userId, day), 0)
    } finally {
        await sql`DELETE FROM image_generation_quota WHERE user_id = ${userId} AND quota_day = ${day}::date`
    }
})
