import express from "express";
import { auth } from "../middlewares/auth.js";
import { generateArticle, generateBlogTitle, generateImage, getImageQuota, removeImageBackground, removeImageObject, resumeReview } from "../controllers/aiController.js";
import { withUpload, requireUploadPlan } from "../configs/multer.js";

const aiRouter = express.Router();

aiRouter.post('/generate-article', auth, generateArticle)
aiRouter.post('/generate-blog-title', auth, generateBlogTitle)
aiRouter.get('/image-quota', getImageQuota)
aiRouter.post('/generate-image', generateImage)
aiRouter.post('/remove-image-background', auth, requireUploadPlan, withUpload('image', removeImageBackground))
aiRouter.post('/remove-image-object', auth, requireUploadPlan, withUpload('image', removeImageObject))
aiRouter.post('/resume-review', auth, requireUploadPlan, withUpload('resume', resumeReview, { maxSize: 5 * 1024 * 1024 }))

export default aiRouter
