import sql from "../configs/db.js"

export const getUserCreations = async (req, res) => {
    try {
        const {userId} = req.auth()

        const creations = await sql`SELECT * FROM creations WHERE user_id = ${userId} ORDER BY created_at DESC`;
        res.json({success: true, creations})

    } catch (error) {
        res.json({success: false, message: error.message})
    }
}

export const getPublishedCreations = async (req, res) => {
    try {
        const creations = await sql`SELECT * FROM creations WHERE publish = true AND type = 'image' ORDER BY created_at DESC`;
        res.json({success: true, creations})

    } catch (error) {
        res.json({success: false, message: error.message})
    }
}

export const toggleLikeCreation = async (req, res) => {
    try {

        const {userId} = req.auth()
        const {id} = req.body // creation id

        const [creation] = await sql`SELECT * FROM creations WHERE id = ${id}`

        if(!creation){
            return res.json({success: false, message: "Creation not found."})
        }

        const currentLikes = creation.likes
        const userIdStr = userId.toString()
        let updatedLikes
        let message

        if(currentLikes.includes(userIdStr)){
            updatedLikes = currentLikes.filter((user)=> user !== userIdStr)
            message = 'Creation Unliked'
        }else{
            updatedLikes = [...currentLikes, userIdStr]
            message = 'Creation Liked'
        }
        // PostgreSQL的数组存储要求‘{，，}’
        const formattedArray = `{${updatedLikes.join(',')}}`
        
        await sql`UPDATE creations SET likes = ${formattedArray}::text[] WHERE id = ${id}`
        
        res.json({success: true, message})

    } catch (error) {
        res.json({success: false, message: error.message})
    }
}

export const setCreationPublish = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { id, publish } = req.body

        const creationId = Number(id)
        if (!Number.isSafeInteger(creationId) || creationId <= 0 || typeof publish !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Invalid publish request.' })
        }

        const [creation] = await sql`UPDATE creations
            SET publish = ${publish}
            WHERE id = ${creationId} AND user_id = ${userId} AND type = 'image'
            RETURNING id, publish`

        if (!creation) {
            return res.status(404).json({ success: false, message: 'Image not found.' })
        }

        res.json({ success: true, creation })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}
