-- Migration: Add unit column to purchases table
-- Description: Add unit field to store measurement units (litre, kg, piece)

ALTER TABLE purchases 
ADD COLUMN unit ENUM('piece', 'kg', 'litre') DEFAULT 'piece' AFTER quantity;

-- Verify the change
-- SELECT * FROM purchases LIMIT 1;
