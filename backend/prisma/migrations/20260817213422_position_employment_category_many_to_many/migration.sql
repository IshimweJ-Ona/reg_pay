-- A position (e.g. "Driver") can now have several employment-category
-- variants (Monthly / Daily / Custom), each with its own default salary.
-- This migration moves the single employment_category_id + default_* pay
-- fields off `positions` into a new `position_employment_categories`
-- many-to-many table, preserving every existing position's current
-- category+defaults as its first row. `employees` gains a direct
-- employment_category_id so an employee's specific variant (not just their
-- position) is recorded, backfilled from their current position's category.

-- 1. New junction table.
CREATE TABLE `position_employment_categories` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `position_id` BIGINT NOT NULL,
  `employment_category_id` BIGINT NOT NULL,
  `default_basic_salary` DECIMAL(18,2) NULL,
  `default_daily_rate` DECIMAL(18,2) NULL,
  `default_overtime_rate` DECIMAL(18,2) NULL,
  `default_custom_work_days` INT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Position_employment_categories_uuid_key` (`uuid`),
  UNIQUE KEY `Position_employment_categories_position_id_employment_categor` (`position_id`, `employment_category_id`),
  KEY `idx_position_employment_category_position` (`position_id`),
  KEY `idx_position_employment_category_category` (`employment_category_id`),
  CONSTRAINT `Position_employment_categories_position_id_fkey` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE CASCADE,
  CONSTRAINT `Position_employment_categories_employment_category_id_fkey` FOREIGN KEY (`employment_category_id`) REFERENCES `employment_categories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Carry every existing position's single category+defaults forward as
-- its first variant row (data-preserving, not a destructive rename).
INSERT INTO `position_employment_categories`
  (`uuid`, `position_id`, `employment_category_id`, `default_basic_salary`, `default_daily_rate`, `default_overtime_rate`, `default_custom_work_days`, `created_at`, `updated_at`)
SELECT UUID(), `id`, `employment_category_id`, `default_basic_salary`, `default_daily_rate`, `default_overtime_rate`, `default_custom_work_days`, NOW(3), NOW(3)
FROM `positions`
WHERE `employment_category_id` IS NOT NULL;

-- 3. employees gains its own direct employment_category_id, backfilled from
-- whatever category their current position was carrying (unambiguous,
-- since every existing position only ever had exactly one category).
ALTER TABLE `employees`
  ADD COLUMN `employment_category_id` BIGINT NULL AFTER `position_id`;

UPDATE `employees` e
JOIN `positions` p ON p.`id` = e.`position_id`
SET e.`employment_category_id` = p.`employment_category_id`
WHERE p.`employment_category_id` IS NOT NULL;

ALTER TABLE `employees`
  ADD CONSTRAINT `Employees_employment_category_id_fkey` FOREIGN KEY (`employment_category_id`) REFERENCES `employment_categories`(`id`);
ALTER TABLE `employees`
  ADD INDEX `idx_employee_employment_category` (`employment_category_id`);

-- 4. Drop the now-redundant single category+defaults columns from positions.
ALTER TABLE `positions` DROP FOREIGN KEY `Positions_employment_category_id_fkey`;
ALTER TABLE `positions` DROP INDEX `idx_position_employment_category`;
ALTER TABLE `positions`
  DROP COLUMN `employment_category_id`,
  DROP COLUMN `default_basic_salary`,
  DROP COLUMN `default_daily_rate`,
  DROP COLUMN `default_overtime_rate`,
  DROP COLUMN `default_custom_work_days`;
