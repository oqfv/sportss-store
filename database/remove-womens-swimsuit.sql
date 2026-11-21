-- Run this once in the Supabase SQL Editor to remove the
-- Women's One-Piece Swimsuit from an existing database.
-- (a fresh install from database.sql no longer has it)

delete from product where name = 'Women''s One-Piece Swimsuit';
