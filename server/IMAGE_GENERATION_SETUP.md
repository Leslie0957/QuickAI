# Image generation setup

The Generate Images page uses Cloudflare Workers AI (`@cf/black-forest-labs/flux-1-schnell`). Set these variables on the **server** Vercel project (`quick-ai-api`) for Production and Preview:

- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID from the Workers AI REST API page.
- `CLOUDFLARE_API_TOKEN`: a Workers AI API token. Keep it out of Git and the client project.

Redeploy the server after adding the variables. The existing Cloudinary and Neon variables must also remain configured. The SQL in `migrations/001_image_generation_quota.sql` creates the quota table; apply it to the same Neon database used by the deployment. The migration was applied to the database in the local server `.env` during development.

Each authenticated user can successfully generate up to 10 images per UTC day. Failed generations release their reserved slot. The page shows the remaining count and refreshes at the next UTC midnight. Image generation is available to free and Premium users; other Premium tools keep their existing plan checks.

To verify the quota against a configured test database:

```sh
cd server
node --env-file=.env --test tests/imageQuota.integration.mjs
```
