-- ============================================
-- MIGRATION v3: Simplify status options
-- Run this in Supabase SQL Editor
-- ============================================

-- Migrate any existing rows to the new statuses
update sales set status = 'under_contract'
  where status in ('pending_earnest', 'secured', 'under_construction');

update sales set status = 'closed'
  where status = 'paid';

-- (cancelled stays cancelled for historical record, but UI hides it)

-- Drop old constraint
alter table sales drop constraint if exists sales_status_check;

-- Add new constraint with just the two main statuses + cancelled (legacy)
alter table sales add constraint sales_status_check
  check (status in ('under_contract', 'closed', 'cancelled'));

-- Update default
alter table sales alter column status set default 'under_contract';
