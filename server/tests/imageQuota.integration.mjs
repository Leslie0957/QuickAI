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
        await sql`DELETE FROM image_generation_quota WHERE user_id = ${userId}`
    }
})

test('next day resets the same row once under concurrency and ignores old releases and reservations', async () => {
    const userId = `quota-test-${randomUUID()}`
    const yesterday = '2026-09-29'
    const today = '2026-09-30'
    try {
        for (let i = 0; i < 10; i++) await reserveImage(userId, yesterday)
        assert.equal(await getRemainingImages(userId, today), 10)
        const reservations = await Promise.all(Array.from({ length: 12 }, () => reserveImage(userId, today)))
        assert.equal(reservations.filter((remaining) => remaining !== null).length, 10)
        assert.equal(reservations.filter((remaining) => remaining === null).length, 2)
        const rows = await sql`SELECT quota_day::text AS day, used FROM image_generation_quota WHERE user_id = ${userId}`
        assert.equal(rows.length, 1)
        assert.equal(rows[0].day, today)
        assert.equal(rows[0].used, 10)
        await releaseImage(userId, yesterday)
        assert.equal(await getRemainingImages(userId, today), 0)
        assert.equal(await reserveImage(userId, yesterday), null)
        assert.equal(await getRemainingImages(userId, today), 0)
        await releaseImage(userId, today)
        assert.equal(await reserveImage(userId, today), 0)
    } finally {
        await sql`DELETE FROM image_generation_quota WHERE user_id = ${userId}`
    }
})

test('releasing the final slot repeatedly cannot make usage negative', async () => {
    const userId = `quota-test-${randomUUID()}`
    const day = currentQuotaDay()
    try {
        await reserveImage(userId, day)
        await releaseImage(userId, day)
        await releaseImage(userId, day)
        assert.equal(await getRemainingImages(userId, day), 10)
    } finally {
        await sql`DELETE FROM image_generation_quota WHERE user_id = ${userId}`
    }
})
