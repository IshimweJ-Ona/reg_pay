-- Positions no longer carry a flat default_tax_percentage number. Taxes and
-- deductions applicable to a position are now assigned via the existing
-- position_deduction_types many-to-many (already supports multiple entries,
-- addable/removable after the position is created).
ALTER TABLE `positions` DROP COLUMN `default_tax_percentage`;
