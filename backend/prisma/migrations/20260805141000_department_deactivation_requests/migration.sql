-- CreateTable
CREATE TABLE `department_deactivation_requests` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `department_id` BIGINT NOT NULL,
    `working_location_id` BIGINT NOT NULL,
    `requested_by` BIGINT NOT NULL,
    `completed_by` BIGINT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `requested_employee_count` INTEGER NOT NULL DEFAULT 0,
    `remaining_employee_count` INTEGER NOT NULL DEFAULT 0,
    `reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `Department_deactivation_requests_uuid_key`(`uuid`),
    INDEX `idx_dept_deactivation_department_status`(`department_id`, `status`),
    INDEX `idx_dept_deactivation_location_status`(`working_location_id`, `status`),
    INDEX `idx_dept_deactivation_requested_by`(`requested_by`),
    INDEX `idx_dept_deactivation_completed_by`(`completed_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `department_deactivation_requests` ADD CONSTRAINT `Dept_deactivation_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_deactivation_requests` ADD CONSTRAINT `Dept_deactivation_location_id_fkey` FOREIGN KEY (`working_location_id`) REFERENCES `working_locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_deactivation_requests` ADD CONSTRAINT `Dept_deactivation_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_deactivation_requests` ADD CONSTRAINT `Dept_deactivation_completed_by_fkey` FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
