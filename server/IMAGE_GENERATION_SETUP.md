# Image generation setup

The Generate Images page uses Cloudflare Workers AI (`@cf/black-forest-labs/flux-1-schnell`). Set these variables on your **server** Vercel project for Production and Preview:

- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID from the Workers AI REST API page.
- `CLOUDFLARE_API_TOKEN`: a Workers AI API token. Keep it out of Git and the client project.

Redeploy the server after adding the variables. The existing Cloudinary and Neon variables must also remain configured. Apply database migrations in order: `001_image_generation_quota.sql` creates the quota table; `003_image_quota_per_user.sql` converts it to one row per user, preserving the latest day's usage. For an existing deployment, apply migration 003 before deploying the updated server. The old service requires the old composite primary key, so coordinate the migration and server update during a maintenance window.

Each authenticated user can successfully generate up to 10 images per UTC day. Failed generations release their reserved slot. The page shows the remaining count and refreshes at the next UTC midnight. Image generation is available to free and Premium users; other Premium tools keep their existing plan checks.

Each user has one quota row (`user_id`, `quota_day`, `used`). A single atomic upsert increments today's usage or resets an earlier day's usage to 1 on the next reservation. Reading an earlier day's row shows all 10 slots available without modifying the row. Failure cleanup matches the original reservation date, preventing old requests from decrementing the new day's quota.

To verify concurrent reservations, day rollover and failure releases against a configured test database with migration 003 applied:

```sh
cd server
node --env-file=.env --test tests/imageQuota.integration.mjs
```
