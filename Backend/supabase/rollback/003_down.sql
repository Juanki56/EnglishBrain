-- =============================================================================
-- EnglishBrain · 003_down.sql
-- Revierte 003_daily_activity.sql. Ejecutar ANTES de 002_down.sql.
-- No borra datos: solo elimina la vista (los datos viven en las tablas).
-- =============================================================================

begin;

drop view if exists public.daily_activity;

commit;
