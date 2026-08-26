-- CreateTable
CREATE TABLE `allowance_types` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `default_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Allowance_types_uuid_key`(`uuid`),
    UNIQUE INDEX `Allowance_types_name_key`(`name`),
    INDEX `idx_allowance_type_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `allowances` ADD COLUMN `allowance_type_id` BIGINT NULL;

-- AlterTable
ALTER TABLE `position_allowance_templates` ADD COLUMN `allowance_type_id` BIGINT NULL;

-- CreateIndex
CREATE INDEX `idx_allowance_type` ON `allowances`(`allowance_type_id`);

-- CreateIndex
CREATE INDEX `idx_position_allowance_template_type` ON `position_allowance_templates`(`allowance_type_id`);

-- AddForeignKey
ALTER TABLE `allowances` ADD CONSTRAINT `Allowances_allowance_type_id_fkey` FOREIGN KEY (`allowance_type_id`) REFERENCES `allowance_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `position_allowance_templates` ADD CONSTRAINT `Position_allowance_templates_allowance_type_id_fkey` FOREIGN KEY (`allowance_type_id`) REFERENCES `allowance_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
