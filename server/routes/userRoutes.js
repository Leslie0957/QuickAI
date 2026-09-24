import express from "express";
import { getPublishedCreations, getUserCreations, setCreationPublish, toggleLikeCreation } from "../controllers/userController.js";

const userRouter = express.Router()

userRouter.get('/get-user-creations', getUserCreations)
userRouter.get('/get-published-creations', getPublishedCreations)
userRouter.post('/toggle-like-creation', toggleLikeCreation)
userRouter.post('/set-creation-publish', setCreationPublish)

export default userRouter