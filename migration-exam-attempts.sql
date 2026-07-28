-- Migration: Add columns to exam_results for enhanced exam attempts
ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS correct_count INTEGER DEFAULT 0;
ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS wrong_count INTEGER DEFAULT 0;

-- Ensure RLS is disabled for exam_results
ALTER TABLE exam_results DISABLE ROW LEVEL SECURITY;
