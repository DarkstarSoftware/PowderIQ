-- Prisma schema sync: Resort mapping + user resortId

-- 1) Ensure User.resortId exists
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "resortId" text;

-- 2) Ensure Resort new map/cache fields exist
ALTER TABLE "Resort"
ADD COLUMN IF NOT EXISTS "liftieSlug" text,
ADD COLUMN IF NOT EXISTS "mapGeoJSON" jsonb,
ADD COLUMN IF NOT EXISTS "mapCacheExpiresAt" timestamptz,
ADD COLUMN IF NOT EXISTS "customMapImageUrl" text,
ADD COLUMN IF NOT EXISTS "customMapBounds" jsonb,
ADD COLUMN IF NOT EXISTS "customMapOpacity" double precision NOT NULL DEFAULT 0.85;