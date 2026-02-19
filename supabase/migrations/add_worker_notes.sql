-- Add worker_notes JSONB column for per-worker instructions
-- Format: { "user-uuid": "instruction text", ... }
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS worker_notes jsonb DEFAULT '{}';
