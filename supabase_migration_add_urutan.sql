-- =========================================
-- MIGRATION: Add 'urutan' column to kategori table
-- Date: 2026-01-20
-- Description: Adds persistent ordering to kategori table
-- =========================================

-- Step 1: Add the 'urutan' column with default value
ALTER TABLE kategori 
ADD COLUMN IF NOT EXISTS urutan INTEGER DEFAULT 0;

-- Step 2: Update existing categories with sequential ordering
-- This will set urutan based on the current order of ID (or you can use creation date if available)
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) as rn
    FROM kategori
)
UPDATE kategori 
SET urutan = numbered.rn
FROM numbered 
WHERE kategori.id = numbered.id;

-- Step 3: Create an index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_kategori_urutan ON kategori(urutan);

-- Optional: Add comment for documentation
COMMENT ON COLUMN kategori.urutan IS 'Order/sequence for displaying categories, lower number = higher priority';
