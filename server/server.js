import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { clerkMiddleware, requireAuth } from '@clerk/express'
import aiRouter from './routes/aiRoutes.js';
import connectCloudinary from './configs/cloudinary.js';
import userRouter from './routes/userRoutes.js';

const app = express()

await connectCloudinary()

app.use(cors())
app.use(express.json())
// 添加之后 对于每个请求都会使用req.auth，从而能够获取用户数据
app.use(clerkMiddleware())

app.get('/', (req, res)=>res.send('Server is Live!'))
// 在这之后的路由会受到保护 只有登录的用户才能访问那些路由 未登录用户会跳转到sign-in页面
app.use(requireAuth())

app.use('/api/ai', aiRouter)
app.use('/api/user', userRouter)

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
    console.log('Server is running on port', PORT)
})