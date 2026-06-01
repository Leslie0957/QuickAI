# QuickAI 后续改进计划与简历表达

> 目的：记录 QuickAI 的技术改进方向、实施顺序和完成后可用于简历的项目描述。
>
> 使用原则：下文标记为“计划”的能力在通过验收前，不应作为已经完成的功能写入简历。

## 一、项目当前状态

QuickAI 当前是一个前后端分离的多模态 AI SaaS 原型，已经具备以下能力：

- React、Vite、Tailwind CSS 构建的单页应用；
- Express REST API；
- Clerk 用户认证、登录状态维护、免费/付费套餐判断；
- Neon PostgreSQL 存储创作记录、发布状态和点赞信息；
- DeepSeek 实现文章、博客标题和简历点评；
- ClipDrop 实现文生图；
- Cloudinary 实现图片存储、去背景和对象移除；
- Multer 处理图片和 PDF 上传；
- 个人创作历史、公开作品社区和点赞功能；
- 基础加载状态、Toast 错误提示、Markdown 渲染和响应式布局。

当前主要不足：

- AI 和第三方服务调用直接写在 Controller 中，缺少 Service/Provider 分层；
- 前端各页面重复配置 Axios 和鉴权请求，没有统一请求层；
- 文本生成使用普通 HTTP 请求，没有流式输出和请求取消；
- 缺少统一参数校验、错误处理中间件、超时及可控重试；
- 上传只有 Loading 状态，没有真实进度、严格文件校验和临时文件清理；
- 免费调用次数存放在 Clerk Metadata 中，缺少独立用量记录；
- 社区和历史记录没有分页；
- 缺少自动化测试、接口文档及持续集成。

## 二、改进目标

将项目从“集成多个 AI API 的功能型原型”升级为“具有流式交互、清晰分层、可靠性保障和可测试性的 AI 全栈 SaaS 项目”。

重点不再继续堆叠功能，而是补充以下技术深度：

1. AI 服务分层与统一接口；
2. SSE 流式生成；
3. 参数校验与统一异常处理；
4. 文件上传可靠性；
5. 数据库与用量系统；
6. 测试、文档和工程化。

## 三、分阶段实施计划

### P0：修复现有问题

计划内容：

- 修复对象移除按钮无法正确禁止重复提交的问题；
- 补充 Dashboard 缺失的 Toast 导入；
- 为异步请求统一使用 `finally` 恢复 Loading 状态；
- 检查文件上传失败、用户未登录、第三方 API 异常等边界情况；
- 避免前端页面反复设置 `axios.defaults.baseURL`。

验收标准：

- 核心页面可正常完成请求；
- 请求成功或失败后 Loading 均能结束；
- 提交期间不能重复发送相同请求；
- 错误路径不会产生新的前端异常。

这一阶段主要用于修复质量问题，不单独作为简历亮点。

### P1：统一前后端服务分层

计划内容：

- 新增前端 Axios 实例，统一 Base URL、Clerk Token、超时和错误转换；
- 将后端第三方服务从 Controller 拆分至 Service/Provider 层；
- 分别封装 DeepSeek、ClipDrop 和 Cloudinary 调用；
- Controller 只负责接收参数、调用业务服务和返回响应；
- 统一第三方服务错误格式，避免直接向前端暴露内部异常。

建议结构：

```text
server/
├── controllers/
├── services/
│   ├── aiService.js
│   ├── creationService.js
│   └── usageService.js
├── providers/
│   ├── deepseekProvider.js
│   ├── clipdropProvider.js
│   └── cloudinaryProvider.js
├── middlewares/
└── routes/
```

验收标准：

- Controller 中不再直接初始化或调用第三方 SDK；
- DeepSeek、ClipDrop 和 Cloudinary 的调用具有统一的内部返回约定；
- 前端 API 请求集中在独立模块中；
- 超时、鉴权头和通用错误不再由每个页面重复处理。

完成后可写的简历表达：

> 封装 DeepSeek、ClipDrop 与 Cloudinary Provider，并通过 Service 层统一处理 Prompt 构造、第三方调用和异常转换，降低业务逻辑与外部服务的耦合。

### P2：SSE 流式文本生成

计划内容：

- DeepSeek 请求开启流式输出；
- Express 使用 SSE 向前端持续发送内容增量；
- 前端使用 Fetch 和 ReadableStream 解析消息分片；
- 支持文章、标题或简历点评的增量渲染；
- 使用 AbortController 支持用户主动停止生成；
- 处理客户端断开、上游异常、超时和不完整消息；
- 生成结束后再将完整内容写入 Neon。

验收标准：

- 首段内容能够在完整生成结束前显示；
- 中文和 Markdown 内容不会因分片出现乱码；
- 用户可主动停止生成；
- 客户端断开后，服务端能终止或清理上游请求；
- 只有成功完成的内容才按预期写入数据库，失败状态有明确记录或不会产生脏数据。

完成后可写的简历表达：

> 基于 SSE 与 Fetch ReadableStream 实现大模型内容流式生成，处理消息分片、增量渲染、请求取消及连接异常，降低用户等待感知。

### P3：参数校验与统一异常处理

计划内容：

- 引入 Zod，对请求体、查询参数和环境变量进行校验；
- 校验文章长度、Prompt 长度、图片格式、文件大小和对象名称；
- 建立统一错误类型及 Express 错误处理中间件；
- 区分参数错误、权限错误、额度不足、第三方超时和服务器错误；
- 为需要结构化结果的 AI 场景增加 JSON Schema/Zod 校验和降级处理；
- 为第三方请求设置超时，对幂等请求增加有限次数的指数退避重试。

验收标准：

- 非法输入在调用第三方服务前被拒绝；
- API 使用一致的错误响应结构；
- 第三方超时不会导致请求无限挂起；
- 重试只用于适合重试的错误，不重复执行不可安全重试的操作；
- AI 结构化输出解析失败时有明确降级路径。

完成后可写的简历表达：

> 基于 Zod 建立接口参数与 AI 结构化输出校验，结合统一异常中间件、请求超时和有限重试机制，完善第三方服务异常兜底。

### P4：文件上传与图片处理可靠性

计划内容：

- 使用 Multer 限制文件类型、扩展名和大小；
- 前端展示真实上传进度；
- 上传过程中支持取消；
- 请求完成或失败后清理本地临时文件；
- 对 Cloudinary 上传和转换错误进行分类处理；
- 评估改为内存上传或直接上传 Cloudinary，减少 Serverless 临时磁盘依赖；
- 为图片结果补充尺寸约束、加载失败状态和重新处理入口。

验收标准：

- 非法格式和超限文件不会进入图片处理流程；
- 页面能显示真实上传百分比，而不只是旋转 Loading；
- 请求成功、失败或取消后均不会遗留临时文件；
- 用户能够区分上传失败与 AI 处理失败。

完成后可写的简历表达：

> 基于 Multer 与 Cloudinary 构建图片上传和 AI 编辑链路，支持文件校验、上传进度、请求取消、临时文件清理及处理结果回显。

### P5：数据库、额度和社区能力

计划内容：

- 将调用额度和使用记录从单一 Clerk Metadata 扩展为数据库用量表；
- 为每次 AI 调用记录用户、能力类型、状态、耗时和必要的用量信息；
- 对历史记录和社区内容增加游标或分页查询；
- 优化点赞数据结构，避免使用单个 `text[]` 字段无限增长；
- 使用唯一约束避免同一用户重复点赞；
- 对关键数据库操作使用事务；
- 增加作品删除、取消发布和权限校验。

可考虑的数据表：

```text
creations
usage_records
creation_likes
```

验收标准：

- 服务端能够准确统计用户调用次数；
- 额度更新具有并发安全性；
- 历史与社区列表支持分页；
- 点赞不会出现重复记录；
- 用户不能修改或删除不属于自己的内容。

完成后可写的简历表达：

> 基于 Clerk 与 Neon PostgreSQL 实现身份鉴权、套餐权限和调用额度管理，并通过分页查询、独立点赞关系及权限校验支持创作历史与作品社区。

### P6：测试、文档与工程化

计划内容：

- 使用 Vitest 或 Jest 编写 Service 和工具函数单元测试；
- 使用 Supertest 覆盖鉴权、额度、AI 接口和异常响应；
- Mock DeepSeek、ClipDrop 和 Cloudinary，避免测试依赖真实第三方服务；
- 增加 ESLint 检查和统一格式化；
- 编写环境变量示例、数据库初始化脚本和本地启动说明；
- 补充 OpenAPI/Swagger 接口文档；
- 配置 CI，自动执行 Lint、Test 和 Build。

验收标准：

- 核心 Service、权限逻辑和接口异常路径有自动化测试；
- 新环境可根据 README 完成启动；
- 提交代码时能够自动执行检查和构建；
- 测试不消耗真实第三方 API 额度。

完成后可写的简历表达：

> 使用 Vitest/Jest、Supertest 和第三方服务 Mock 覆盖核心业务与异常路径，并通过 CI 自动执行 Lint、Test 和 Build，提高项目可维护性。

## 四、推荐实施顺序

```text
P0 修复问题
 → P1 Service/Provider 分层
 → P2 SSE 流式生成
 → P3 校验与错误处理
 → P4 文件上传可靠性
 → P5 数据库与额度系统
 → P6 测试与工程化
```

如果时间有限，优先完成：

1. P0 现有问题修复；
2. P1 Service/Provider 分层；
3. P2 SSE 流式生成；
4. P3 Zod 校验与统一错误处理。

这四项能够以相对可控的工作量，明显提升项目的技术深度和面试可讲性。

## 五、当前可使用的简历表达

在上述改造尚未完成前，建议使用与当前代码一致的版本：

> **QuickAI 多模态创作平台｜AI 全栈 SaaS 原型**  
> **技术栈：** React、Vite、Tailwind CSS、Node.js、Express、Clerk、Neon PostgreSQL、DeepSeek、ClipDrop、Cloudinary
>
> - 基于 React、Express 与 Neon PostgreSQL 构建多模态 AI 创作平台，覆盖文章与标题生成、文生图、图片编辑、简历分析、创作历史及社区互动。
> - 对接 DeepSeek、ClipDrop 与 Cloudinary API，实现文本生成、图像生成、图片去背景和对象移除，并支持文章长度、图像风格及内容公开状态等参数配置。
> - 基于 Multer 与 Cloudinary 完成文件上传、云端存储和 AI 图片处理，通过加载状态、错误提示及结果回显完善交互流程。
> - 基于 Clerk 实现用户认证、Token 鉴权、免费/付费权限和免费调用次数控制；结合 Neon 持久化创作记录，实现历史查询、作品发布和社区点赞。

## 六、核心改造完成后的目标简历表达

以下版本仅在对应功能实际完成并通过验收后使用：

> **QuickAI 多模态创作平台｜AI 全栈 SaaS**  
> **技术栈：** React、Vite、Tailwind CSS、Node.js、Express、SSE、Zod、Clerk、Neon PostgreSQL、DeepSeek、ClipDrop、Cloudinary
>
> - 基于 React、Express 与 Neon PostgreSQL 构建多模态 AI 创作平台，覆盖文本生成、文生图、图片编辑、简历分析、创作历史及作品社区。
> - 封装 DeepSeek、ClipDrop 与 Cloudinary Provider，通过 Service 层统一处理 Prompt 构造、参数校验、第三方调用和异常转换，降低外部服务与业务逻辑的耦合。
> - 基于 SSE 与 Fetch ReadableStream 实现大模型内容流式生成，处理消息分片、增量渲染、请求取消及连接异常，降低用户等待感知。
> - 基于 Zod、统一异常中间件、请求超时和有限重试机制完善异常兜底；基于 Multer 与 Cloudinary 实现文件校验、上传进度、临时文件清理和 AI 图片处理。
> - 基于 Clerk 与 Neon 实现身份鉴权、套餐权限、调用额度、创作历史、作品发布及社区点赞，并通过分页、唯一约束和事务保证数据一致性。

## 七、面试时可重点讲解的问题

改造完成后，应能够结合代码回答以下问题：

- 为什么文本生成使用 SSE，而不是 WebSocket？
- 如何处理 SSE 分片、中文乱码、断线和用户主动取消？
- 为什么要拆分 Controller、Service 和 Provider？
- 哪些第三方请求可以重试，如何避免重复扣费或重复写入？
- AI 返回的结构化 JSON 不合法时如何处理？
- 上传失败、图片处理失败和数据库写入失败如何区分？
- 免费额度在并发请求下如何避免被绕过？
- 点赞为什么不继续使用 PostgreSQL `text[]`？
- 如何在测试中 Mock DeepSeek、ClipDrop 和 Cloudinary？

只有真正理解并实现上述内容，简历中的技术表述才具有可信度。
