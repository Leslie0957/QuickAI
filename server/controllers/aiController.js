import OpenAI from "openai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import {v2 as cloudinary} from 'cloudinary';
import axios from "axios";
import fs from 'fs'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { DAILY_IMAGE_LIMIT, currentQuotaDay, getRemainingImages, releaseImage, reserveImage } from '../services/imageQuota.js'
import { syncPublicProfile } from '../services/publicProfiles.js'

const AI =
 new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com"
});

const sendEvent = (res, event, data) => {
    if (!res.writableEnded && !res.destroyed) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }
}

const streamTextCreation = async (req, res, { maxTokens, type, truncatedMessage }) => {
    const { userId } = req.auth()
    const { prompt } = req.body
    const plan = req.plan
    const freeUsage = req.free_usage

    if (plan !== 'premium' && freeUsage >= 10) {
        return res.json({ success: false, message: "Limit reached. Upgrade to continue." })
    }

    const saveCreation = async (content) => {
        await sql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, ${prompt}, ${content}, ${type})`
        if (plan !== 'premium') {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: { free_usage: freeUsage + 1 }
            })
        }
    }

    // Existing deployments still expect JSON until their frontend is updated.
    if (!req.get('Accept')?.includes('text/event-stream')) {
        try {
            const response = await AI.chat.completions.create({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: maxTokens,
            })
            const choice = response.choices[0]
            if (choice.finish_reason === 'length' && type === 'blog-title') {
                return res.json({ success: false, message: truncatedMessage })
            }
            const content = choice.message.content
            await saveCreation(content)
            return res.json({ success: true, content })
        } catch (error) {
            console.error(error)
            return res.json({ success: false, message: error.message })
        }
    }

    const abortController = new AbortController()
    let disconnected = false
    res.on('close', () => {
        if (!res.writableEnded) {
            disconnected = true
            abortController.abort()
        }
    })

    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no'
    })
    res.flushHeaders()

    try {
        const stream = await AI.chat.completions.create({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: maxTokens,
            stream: true,
        }, { signal: abortController.signal })

        let content = ''
        let finishReason
        for await (const chunk of stream) {
            if (disconnected) return
            const choice = chunk.choices[0]
            const text = choice?.delta?.content
            if (text) {
                content += text
                sendEvent(res, 'chunk', { text })
            }
            if (choice?.finish_reason) finishReason = choice.finish_reason
        }

        if (disconnected) return
        if (finishReason === 'length') throw new Error(truncatedMessage)
        if (!content.trim() || finishReason !== 'stop') {
            throw new Error('Generation did not complete. Please try again.')
        }

        await saveCreation(content)
        sendEvent(res, 'done', {})
    } catch (error) {
        if (!disconnected) {
            console.error(error)
            sendEvent(res, 'error', { message: error.message || 'Generation failed.' })
        }
    } finally {
        if (!res.writableEnded) res.end()
    }
}

export const generateArticle = (req, res) => streamTextCreation(req, res, {
    maxTokens: Math.min(Math.max(Number(req.body.length) || 800, 800) * 2, 3200),
    type: 'article',
    truncatedMessage: 'Article generation was cut off. Please try again.'
})

export const generateBlogTitle = (req, res) => streamTextCreation(req, res, {
    maxTokens: 400,
    type: 'blog-title',
    truncatedMessage: 'Title generation was cut off. Please try again.'
})

export const getImageQuota = async (req, res) => {
    try {
        const day = currentQuotaDay()
        const remaining = await getRemainingImages(req.auth().userId, day)
        const resetsAt = new Date(Date.parse(`${day}T00:00:00.000Z`) + 86400000).toISOString()
        res.json({ success: true, limit: DAILY_IMAGE_LIMIT, remaining, resetsAt })
    } catch (error) {
        console.error('Image quota lookup failed:', error.message)
        res.status(500).json({ success: false, message: 'Could not load image quota.' })
    }
}

export const generateImage = async (req, res) => {
    const { userId } = req.auth()
    const { prompt, publish = false } = req.body || {}
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 2048 || typeof publish !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Enter an image description (up to 2048 characters).' })
    }
    const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
        return res.status(503).json({ success: false, message: 'Image generation is not configured yet.' })
    }

    const day = currentQuotaDay()
    let reserved = false
    let saved = false
    let stage = 'quota'
    try {
        const remaining = await reserveImage(userId, day)
        if (remaining === null) {
            return res.status(429).json({ success: false, remaining: 0, message: 'Daily limit reached. You can generate 10 images per day.' })
        }
        reserved = true

        stage = 'provider'
        const { data } = await axios.post(
            `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
            { prompt: prompt.trim() },
            {
                headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
                timeout: 90000,
            }
        )
        if (!data?.success || !data.result?.image) {
            throw new Error('Image provider returned no image.')
        }

        stage = 'storage'
        const { secure_url } = await cloudinary.uploader.upload(`data:image/jpeg;base64,${data.result.image}`)
        stage = 'database'
        await sql`
            INSERT INTO creations (user_id, prompt, content, type, publish)
            VALUES (${userId}, ${prompt.trim()}, ${secure_url}, 'image', ${publish})
        `
        saved = true
        if (publish) await syncPublicProfile(userId)
        res.json({ success: true, content: secure_url, remaining })
    } catch (error) {
        if (reserved && !saved) {
            try {
                await releaseImage(userId, day)
            } catch (releaseError) {
                console.error('Image quota release failed:', releaseError.message)
            }
        }
        console.error(`Image generation failed at ${stage}:`, error.response?.status, error.message)
        if (stage === 'quota') {
            return res.status(500).json({ success: false, message: 'Could not check your image quota. Please try again.' })
        }
        if (stage === 'provider') {
            const providerStatus = error.response?.status
            const message = providerStatus === 429
                ? 'Image service is busy. Please try again later.'
                : providerStatus === 401 || providerStatus === 403
                    ? 'Image service credentials need to be checked.'
                    : 'Image generation failed. Please try again.'
            return res.status(502).json({ success: false, message })
        }
        res.status(500).json({ success: false, message: 'Could not save the generated image. Please try again.' })
    }
}

// 只有付费用户才能使用接下来的功能
export const removeImageBackground = async (req, res)=>{
    try {
        const {userId} = req.auth();
        const image = req.file;
        const plan = req.plan;

        if(plan !== 'premium'){
            return res.json({ success: false, message: "This feature is only avaliable for premium subscriptions."})
        }

        const {secure_url} = await cloudinary.uploader.upload(image.path, {
            transformation: [
                {
                    effect: 'background_removal',
                    background_removal: 'remove_the_background'
                }
            ]
        })

        await sql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, 'Remove background from image', ${secure_url}, 'image')`;

        res.json({ success: true, content: secure_url})
        
    } catch (error) {
        console.log(error.message)
        res.json({ success: false, message: error.message})
    }
}

export const removeImageObject = async (req, res)=>{
    try {
        const {userId} = req.auth();
        const {object} = req.body;
        const image = req.file;
        const plan = req.plan;

        if(plan !== 'premium'){
            return res.json({ success: false, message: "This feature is only avaliable for premium subscriptions."})
        }

        const {public_id} = await cloudinary.uploader.upload(image.path)

        const imageUrl = cloudinary.url(public_id, {
            transformation: [{effect: `gen_remove:${object}`}],
            resource_type: 'image'
        })

        await sql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image')`;

        res.json({ success: true, content: imageUrl})
        
    } catch (error) {
        console.log(error.message)
        res.json({ success: false, message: error.message})
    }
}

export const resumeReview = async (req, res)=>{
    try {
        const {userId} = req.auth();
        const resume = req.file;
        const plan = req.plan;

        if(plan !== 'premium'){
            return res.json({ success: false, message: "This feature is only avaliable for premium subscriptions."})
        }

        if(resume.size > 5 * 1024 * 1024){
            return res.json({success: false, message: "Resume file size exceeds allowed size (5MB)."})
        }

        const dataBuffer = fs.readFileSync(resume.path)
        const pdfData = await pdf(dataBuffer)

        const prompt = `Review the following resume and provide constructive feedback on its strengths, weakness, and areas for improvement. Resume Content:\n\n${pdfData.text}`

        const response = await AI.chat.completions.create({
            model: "deepseek-chat",
            messages: [{
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 1000,
        });

        const content = response.choices[0].message.content


        await sql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')`;

        res.json({ success: true, content})
        
    } catch (error) {
        console.log(error.message)
        res.json({ success: false, message: error.message})
    }
}