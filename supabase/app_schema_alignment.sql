-- Align existing Supabase tables with the current frontend + edge function code.
-- Run this in the Supabase SQL editor after the base schema / RLS script.

-- ==========================================
-- jobRequests
-- ==========================================
ALTER TABLE public."jobRequests"
  ALTER COLUMN "roleTitle" DROP NOT NULL;

ALTER TABLE public."jobRequests"
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS "createdById" uuid,
  ADD COLUMN IF NOT EXISTS "conversationHistory" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "finalDescription" text,
  ADD COLUMN IF NOT EXISTS "finalRequirements" text,
  ADD COLUMN IF NOT EXISTS "templateId" uuid;

UPDATE public."jobRequests"
SET title = COALESCE(title, "roleTitle")
WHERE title IS NULL;

-- ==========================================
-- jobPostings
-- ==========================================
ALTER TABLE public."jobPostings"
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS requirements text,
  ADD COLUMN IF NOT EXISTS "salaryRange" text,
  ADD COLUMN IF NOT EXISTS "postedById" uuid,
  ADD COLUMN IF NOT EXISTS "postedAt" timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "fulfilledAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "templateId" uuid;

UPDATE public."jobPostings"
SET "postedAt" = COALESCE("postedAt", "publishedAt", "createdAt")
WHERE "postedAt" IS NULL;

-- ==========================================
-- postingSources
-- ==========================================
ALTER TABLE public."postingSources"
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz DEFAULT now();

-- ==========================================
-- jobPostingLogs
-- ==========================================
ALTER TABLE public."jobPostingLogs"
  ADD COLUMN IF NOT EXISTS "jobPostingId" uuid,
  ADD COLUMN IF NOT EXISTS "postingSourceId" uuid,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS "externalJobId" text,
  ADD COLUMN IF NOT EXISTS "externalUrl" text,
  ADD COLUMN IF NOT EXISTS "attemptCount" integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "attemptedAt" timestamptz DEFAULT now();

UPDATE public."jobPostingLogs"
SET
  "jobPostingId" = COALESCE("jobPostingId", "postingId"),
  "postingSourceId" = COALESCE("postingSourceId", "sourceId"),
  "lastAttemptAt" = COALESCE("lastAttemptAt", "attemptedAt", "createdAt"),
  "attemptedAt" = COALESCE("attemptedAt", "createdAt")
WHERE
  "jobPostingId" IS NULL
  OR "postingSourceId" IS NULL
  OR "lastAttemptAt" IS NULL
  OR "attemptedAt" IS NULL;

UPDATE public."jobPostingLogs" logs
SET platform = sources.platform
FROM public."postingSources" sources
WHERE logs."sourceId" = sources.id
  AND logs.platform IS NULL;

-- Optional helper indexes for the current app queries
CREATE INDEX IF NOT EXISTS idx_job_requests_created_at ON public."jobRequests" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_job_postings_created_at ON public."jobPostings" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_job_posting_logs_created_at ON public."jobPostingLogs" ("createdAt" DESC);
