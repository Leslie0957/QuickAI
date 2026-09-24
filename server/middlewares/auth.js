import { clerkClient } from "@clerk/express"

// Middleware to check userId and hasPremiumPlan


export const auth = async (req, res, next) => {
    try {
        const { userId, has } = req.auth()
        const hasPremiumPlan = has({ plan: 'premium' })

        req.plan = hasPremiumPlan ? 'premium' : 'free'
        req.free_usage = 0

        if (!hasPremiumPlan) {
            const user = await clerkClient.users.getUser(userId)
            req.free_usage = Number(user.privateMetadata?.free_usage) || 0
        }

        next()
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message })
    }
}
