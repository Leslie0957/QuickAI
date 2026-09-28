# QuickAI 前端

基于 React、Vite 和 Tailwind CSS 的 AI 创作界面。

- [项目介绍与在线体验](../README.md)

## 开发

按照根目录 README 配置 `client/.env`，然后运行：

```sh
npm ci
npm run dev
```

## 构建与测试

```sh
npm run build
node --test tests/*.test.mjs
```

## 请求层

- `src/api/http.js`：独立 Axios 实例、鉴权与错误转换。
- `src/api/stream.js`：SSE 解析、完成检查、取消及支持上传进度的流式请求。
- `src/api/ai.js`：六项 AI 功能与图片额度的业务方法。

页面负责输入和展示；三个上传页面通过 `useUploadRequest` 管理进度、手动重试与取消。
