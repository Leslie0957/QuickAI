# QuickAI · 多模态 AI 创作平台

集文章创作、标题生成、图像生成、图片编辑和 PDF 简历点评于一体的全栈 Web 应用。通过流式输出、创作历史与社区分享，将 AI 生成、结果管理和作品交流串联起来。

**[在线体验](https://quick-ai-leslie.vercel.app) · [功能入口](https://quick-ai-leslie.vercel.app/ai) · [工程实践与面试笔记](INTERVIEW_NOTES.md)**

## 功能概览

| 功能 | 使用方式 |
| --- | --- |
| 文章生成 | 输入主题、选择长度，实时接收 Markdown 内容 |
| 标题生成 | 按关键词和分类生成标题，支持流式展示 |
| 图像生成 | 选择风格生成图片，查看每日剩余额度，可公开分享 |
| 去除背景 / 对象 | 上传图片进行编辑，显示上传进度与处理状态 |
| 简历点评 | 上传不超过 5 MB 的 PDF，流式展示反馈，支持停止生成 |
| Dashboard | 查看创作历史、展开结果、管理图片公开状态 |
| Community | 展示作者昵称与头像、分页浏览作品、点赞互动 |

## 工程亮点

- **统一 AI 请求层**：HTTP、SSE 和业务方法分层，集中处理 Base URL、鉴权、错误转换及请求取消。
- **流式交互**：解析跨网络分片的 SSE 事件，支持 Markdown 实时渲染、输出跟随滚动与完成状态检查。
- **缓存与局部更新**：Dashboard 和社区使用已有缓存即时展示、后台刷新；点赞更新单张卡片，失败时回滚状态。
- **上传生命周期管理**：真实上传字节进度与业务处理状态分离；失败保留输入并支持手动重试，避免重复提交；服务端统一清理临时文件。
- **身份与额度控制**：Clerk 管理认证和会话，后端校验功能权限；Neon 保存作品和图像生成额度，每用户每天最多生成 10 张图片。
- **前后端独立部署**：React 前端与 Express API 分别部署到 Vercel，GitHub 推送触发更新。

## 演示范围

- 首页的用户评价是虚构的演示文案，不代表真实客户评价或用户规模。
- `Watch demo` 视频尚未实现；邮件订阅表单尚未接入发送服务。
- Clerk 会员订阅用于开发测试，当前展示不代表正式商业订阅服务。
- 部分介绍与政策页面尚未开放，首页已标注对应状态。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 19、Vite、Tailwind CSS、React Router、Axios、React Markdown |
| 后端 | Node.js、Express、Multer、PDF Parse |
| 数据与身份 | Neon PostgreSQL、Clerk |
| AI 与图片处理 | DeepSeek、Cloudflare Workers AI（FLUX.1 schnell）、Cloudinary |
| 部署 | GitHub、Vercel |

## 展示建议

1. 登录后生成一篇短文章，展示逐段输出与 Markdown 渲染。
2. 生成图片并公开，在 Community 查看作者信息、点赞和作品列表。
3. 返回 Dashboard 查看记录；再次切换页面，展示缓存数据与后台更新。
4. 上传 PDF 简历，展示上传进度、流式点评与停止生成。

图像额度按 UTC 每日重置。去背景、对象移除与简历点评需要 Premium 权限；功能是否可用也取决于相应第三方服务配置与额度。

## 目录结构

```text
client/
  src/api/           HTTP、SSE 与 AI 业务请求
  src/components/    复用 UI 组件
  src/hooks/         上传状态与取消管理
  src/pages/         创作工具、Dashboard、Community
  tests/             请求层与流式解析测试
server/
  controllers/       AI 与作品业务处理
  middlewares/       权限检查
  configs/           数据库、Cloudinary 与上传清理
  services/          图像额度与公开作者资料
  migrations/        数据库增量 SQL
  tests/             上传清理等测试
```

## 本地运行

需要 Node.js 与 npm，以及 Clerk、Neon、DeepSeek、Cloudflare Workers AI 和 Cloudinary 的相应配置。密钥只放在本地环境文件或部署平台中。

前端 `client/.env`：

```dotenv
VITE_BASE_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

后端 `server/.env`：

```dotenv
PORT=3000
DATABASE_URL=your_neon_connection_string
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
DEEPSEEK_API_KEY=your_deepseek_api_key
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_workers_ai_token
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

数据库需要已有 `creations` 基础表，然后按顺序执行 `server/migrations/` 中的 SQL。当前仓库提供的是增量迁移，不包含基础表初始化脚本。图像服务配置见 [Image generation setup](server/IMAGE_GENERATION_SETUP.md)。

分别在两个终端启动：

```sh
cd server
npm ci
npm run server
```

```sh
cd client
npm ci
npm run dev
```

## 构建与验证

```sh
# 前端生产构建
cd client
npm run build

# 前端请求与 SSE 测试（在 client 目录）
node --test tests/*.test.mjs

# 上传清理测试（在 server 目录）
node --test tests/upload.test.mjs
```

以上请求与上传测试使用模拟响应或本地测试服务，不需要调用真实 AI 服务。线上展示前还需确认身份权限、环境变量及第三方服务额度。
