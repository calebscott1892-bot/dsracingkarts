-- ============================================================
-- DS Racing Karts - nullable category suggestions
-- Allows review rows to exist even when no strong category match
-- has been found yet, so every uncategorised item can appear in
-- the review/export workflow.
-- ============================================================

alter table category_assignment_suggestions
  alter column suggested_category_id drop not null;
