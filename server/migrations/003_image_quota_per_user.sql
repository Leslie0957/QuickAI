-- Apply before deploying the single-row quota service.
-- Keep each user's latest quota and its usage, including today's reservations.
BEGIN;
LOCK TABLE image_generation_quota IN ACCESS EXCLUSIVE MODE;

DELETE FROM image_generation_quota older
USING image_generation_quota newer
WHERE older.user_id = newer.user_id AND older.quota_day < newer.quota_day;

ALTER TABLE image_generation_quota
    DROP CONSTRAINT image_generation_quota_pkey;
ALTER TABLE image_generation_quota
    ADD PRIMARY KEY (user_id);
COMMIT;
