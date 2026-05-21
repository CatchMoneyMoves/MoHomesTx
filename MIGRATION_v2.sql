-- ============================================
-- MIGRATION: Add annual_sales_volume_goal column
-- Run this in Supabase SQL Editor
-- ============================================

alter table settings
add column if not exists annual_sales_volume_goal numeric(14,2) default 10000000;

-- Backfill existing rows that have NULL
update settings
set annual_sales_volume_goal = 10000000
where annual_sales_volume_goal is null;
