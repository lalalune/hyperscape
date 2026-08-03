-- Migration: Allow quantity=0 in bank_storage for modern MMORPG-style placeholders
-- When a player withdraws all of an item, the row stays with quantity=0
-- to reserve the bank slot (placeholder). The previous constraint (>=1)
-- blocked this, causing withdraw failures.

ALTER TABLE bank_storage DROP CONSTRAINT IF EXISTS bank_quantity_positive;
--> statement-breakpoint
ALTER TABLE bank_storage ADD CONSTRAINT bank_quantity_positive CHECK (quantity >= 0);
