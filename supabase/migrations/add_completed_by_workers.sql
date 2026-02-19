-- Add completed_by_workers array to track individual worker completions
-- A stage is only fully "completed" when ALL assigned workers are in this array
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS completed_by_workers text[] DEFAULT '{}';
