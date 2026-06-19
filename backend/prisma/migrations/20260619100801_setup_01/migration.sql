-- CreateTable
CREATE TABLE `Notifications` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `user_id` BIGINT NULL,
    `sender_id` BIGINT NULL,
    `target_role` VARCHAR(50) NULL,
    `target_department_id` BIGINT NULL,
    `title` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `reference_id` CHAR(36) NULL,
    `metadata` JSON NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `action_taken` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Notifications_uuid_key`(`uuid`),
    INDEX `idx_notification_user`(`user_id`),
    INDEX `idx_notification_sender`(`sender_id`),
    INDEX `idx_notification_read`(`is_read`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Working_locations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `type` ENUM('HQ', 'BRANCH') NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BIGINT NULL,
    `updated_by` BIGINT NULL,
    `deleted_by` BIGINT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `Working_locations_uuid_key`(`uuid`),
    UNIQUE INDEX `Working_locations_name_key`(`name`),
    INDEX `idx_working_location_type`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Branch_managers` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `working_location_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unassigned_at` DATETIME(3) NULL,
    `assigned_by` BIGINT NOT NULL,

    UNIQUE INDEX `Branch_managers_uuid_key`(`uuid`),
    INDEX `idx_branch_manager_location`(`working_location_id`),
    INDEX `idx_branch_manager_user`(`user_id`),
    INDEX `idx_branch_manager_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Departments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `working_location_id` BIGINT NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Departments_uuid_key`(`uuid`),
    INDEX `idx_department_location`(`working_location_id`),
    UNIQUE INDEX `Departments_working_location_id_code_key`(`working_location_id`, `code`),
    UNIQUE INDEX `Departments_working_location_id_name_key`(`working_location_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department_managers` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `department_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unassigned_at` DATETIME(3) NULL,
    `assigned_by` BIGINT NOT NULL,

    UNIQUE INDEX `Department_managers_uuid_key`(`uuid`),
    INDEX `idx_department_manager_department`(`department_id`),
    INDEX `idx_department_manager_user`(`user_id`),
    INDEX `idx_department_manager_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `working_location_id` BIGINT NULL,
    `department_id` BIGINT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone_number` VARCHAR(20) NOT NULL,
    `password_hash` TEXT NOT NULL,
    `reset_password_token` VARCHAR(255) NULL,
    `reset_password_expires` DATETIME(3) NULL,
    `gender` ENUM('MALE', 'FEMALE') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'REJECTED') NOT NULL DEFAULT 'ACTIVE',
    `avatar_url` TEXT NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `Users_uuid_key`(`uuid`),
    UNIQUE INDEX `Users_email_key`(`email`),
    UNIQUE INDEX `Users_phone_number_key`(`phone_number`),
    UNIQUE INDEX `Users_reset_password_token_key`(`reset_password_token`),
    INDEX `idx_user_location`(`working_location_id`),
    INDEX `idx_user_department`(`department_id`),
    INDEX `idx_user_status`(`status`),
    INDEX `idx_user_first_name`(`first_name`),
    INDEX `idx_user_last_name`(`last_name`),
    INDEX `idx_user_uuid`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User_departments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `department_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_departments_user`(`user_id`),
    INDEX `idx_user_departments_department`(`department_id`),
    UNIQUE INDEX `User_departments_user_id_department_id_key`(`user_id`, `department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Roles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `level_order` INTEGER NULL,
    `is_system_role` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Roles_uuid_key`(`uuid`),
    UNIQUE INDEX `Roles_name_key`(`name`),
    INDEX `idx_role_level`(`level_order`),
    INDEX `idx_role_uuid`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User_roles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `role_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_roles_user_id_role_id_key`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permissions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `module_name` VARCHAR(100) NOT NULL,
    `permission_key` VARCHAR(150) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Permissions_uuid_key`(`uuid`),
    UNIQUE INDEX `Permissions_name_key`(`name`),
    UNIQUE INDEX `Permissions_permission_key_key`(`permission_key`),
    INDEX `idx_permission_module`(`module_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role_permissions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT NOT NULL,
    `permission_id` BIGINT NOT NULL,

    UNIQUE INDEX `Role_permissions_role_id_permission_id_key`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User_permissions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `permission_id` BIGINT NOT NULL,
    `granted_by` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_permission_user`(`user_id`),
    INDEX `idx_user_permission_permission`(`permission_id`),
    UNIQUE INDEX `User_permissions_user_id_permission_id_key`(`user_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User_permission_overrides` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `permission_id` BIGINT NOT NULL,
    `is_allowed` BOOLEAN NOT NULL DEFAULT true,
    `changed_by` BIGINT NULL,
    `reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_permission_overrides_uuid_key`(`uuid`),
    INDEX `idx_user_permission_override_user`(`user_id`),
    INDEX `idx_user_permission_override_permission`(`permission_id`),
    INDEX `idx_user_permission_override_allowed`(`is_allowed`),
    UNIQUE INDEX `User_permission_overrides_user_id_permission_id_key`(`user_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employment_categories` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `payroll_frequency` ENUM('DAILY', 'MONTHLY', 'CUSTOM') NOT NULL,
    `tax_behavior` ENUM('STANDARD', 'PERIODIC', 'EXEMPT') NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Employment_categories_uuid_key`(`uuid`),
    UNIQUE INDEX `Employment_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employees` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NULL,
    `phone_number` VARCHAR(20) NULL,
    `national_id` VARCHAR(50) NULL,
    `gender` ENUM('MALE', 'FEMALE') NULL,
    `hire_date` DATE NULL,
    `department_id` BIGINT NULL,
    `working_location_id` BIGINT NULL,
    `employment_category_id` BIGINT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'REJECTED') NOT NULL DEFAULT 'ACTIVE',
    `created_by` BIGINT NULL,
    `avatar_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `Employees_uuid_key`(`uuid`),
    UNIQUE INDEX `Employees_email_key`(`email`),
    UNIQUE INDEX `Employees_phone_number_key`(`phone_number`),
    UNIQUE INDEX `Employees_national_id_key`(`national_id`),
    INDEX `idx_employee_department`(`department_id`),
    INDEX `idx_employee_location`(`working_location_id`),
    INDEX `idx_employee_category`(`employment_category_id`),
    INDEX `idx_employee_status`(`status`),
    INDEX `idx_employee_created_by`(`created_by`),
    INDEX `idx_employee_first_name`(`first_name`),
    INDEX `idx_employee_last_name`(`last_name`),
    INDEX `idx_employee_email`(`email`),
    INDEX `idx_employee_phone`(`phone_number`),
    INDEX `idx_employee_national_id`(`national_id`),
    INDEX `idx_employee_deleted_at`(`deleted_at`),
    INDEX `idx_employee_uuid`(`uuid`),
    UNIQUE INDEX `Employees_first_name_last_name_working_location_id_departmen_key`(`first_name`, `last_name`, `working_location_id`, `department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee_documents` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `employee_id` BIGINT NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_path` TEXT NOT NULL,
    `uploaded_by` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Employee_documents_uuid_key`(`uuid`),
    INDEX `idx_employee_document_employee`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `employee_id` BIGINT NOT NULL,
    `action_type` ENUM('UPDATE', 'TRANSFER', 'SUSPENDED', 'CATEGORY_CHANGE') NOT NULL,
    `old_department_id` BIGINT NULL,
    `new_department_id` BIGINT NULL,
    `old_location_id` BIGINT NULL,
    `new_location_id` BIGINT NULL,
    `old_employment_category_id` BIGINT NULL,
    `new_employment_category_id` BIGINT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL,
    `reason` TEXT NULL,
    `changed_by` BIGINT NOT NULL,
    `approved_by` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Employee_history_uuid_key`(`uuid`),
    INDEX `idx_employee_history_employee`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment_structures` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `employee_id` BIGINT NOT NULL,
    `payroll_frequency` ENUM('DAILY', 'MONTHLY', 'CUSTOM') NOT NULL,
    `basic_salary` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `daily_rate` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `overtime_rate` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `custom_work_days` INTEGER NULL,
    `tax_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `effective_from` DATE NOT NULL,
    `effective_to` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_structures_uuid_key`(`uuid`),
    INDEX `idx_payment_structure_employee`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Allowances` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `employee_id` BIGINT NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Allowances_uuid_key`(`uuid`),
    INDEX `idx_allowance_employee`(`employee_id`),
    INDEX `idx_allowance_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Deduction_types` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `deduction_mode` ENUM('FIXED', 'PERCENTAGE') NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `percentage_value` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `is_mandatory` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Deduction_types_uuid_key`(`uuid`),
    UNIQUE INDEX `Deduction_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee_deductions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `employee_id` BIGINT NOT NULL,
    `deduction_type_id` BIGINT NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Employee_deductions_uuid_key`(`uuid`),
    INDEX `idx_employee_deduction_employee`(`employee_id`),
    INDEX `idx_employee_deduction_type`(`deduction_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Time_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `employee_id` BIGINT NOT NULL,
    `attendance_date` DATE NOT NULL,
    `clock_in` DATETIME(3) NULL,
    `clock_out` DATETIME(3) NULL,
    `hours_worked` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `overtime_hours` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `attendance_status` ENUM('PRESENT', 'ABSENT') NOT NULL,
    `approved_by` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Time_records_uuid_key`(`uuid`),
    UNIQUE INDEX `Time_records_employee_id_attendance_date_key`(`employee_id`, `attendance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transactions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `employee_id` BIGINT NOT NULL,
    `payment_structure_id` BIGINT NOT NULL,
    `payroll_month` INTEGER NOT NULL,
    `payroll_year` INTEGER NOT NULL,
    `gross_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `base_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `allowance_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `tax_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `attendance_days` INTEGER NOT NULL DEFAULT 0,
    `payroll_work_days` INTEGER NULL,
    `payroll_start_date` DATE NULL,
    `payroll_end_date` DATE NULL,
    `calculation_metadata` JSON NULL,
    `total_deductions` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `net_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `payment_date` DATE NOT NULL,
    `payment_method` ENUM('BANK', 'CASH', 'MOMO') NOT NULL,
    `transaction_status` ENUM('PENDING', 'PAID', 'REJECTED', 'FAILED') NOT NULL,
    `approved_by` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Transactions_uuid_key`(`uuid`),
    INDEX `idx_transaction_employee`(`employee_id`),
    INDEX `idx_transaction_status`(`transaction_status`),
    INDEX `idx_transaction_date`(`payment_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment_batches` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `batch_code` VARCHAR(100) NOT NULL,
    `working_location_id` BIGINT NOT NULL,
    `payroll_month` INTEGER NOT NULL,
    `payroll_year` INTEGER NOT NULL,
    `total_employees` INTEGER NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `total_gross` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `total_allowances` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `total_deductions` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `total_tax` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('DRAFT', 'PENDING', 'IN_REVIEW', 'MANAGER_APPROVED', 'APPROVED', 'REJECTED', 'REJECTED_BY_BRANCH_MANAGER', 'REJECTED_BY_SUPER_ADMIN') NOT NULL,
    `current_approval_step` INTEGER NOT NULL DEFAULT 1,
    `rejected_reason` TEXT NULL,
    `submitted_by` BIGINT NOT NULL,
    `approved_by` BIGINT NULL,
    `submitted_at` DATETIME(3) NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_batches_uuid_key`(`uuid`),
    UNIQUE INDEX `Payment_batches_batch_code_key`(`batch_code`),
    INDEX `idx_payment_batch_location`(`working_location_id`),
    INDEX `idx_payment_batch_status`(`status`),
    INDEX `idx_payment_batch_period`(`payroll_month`, `payroll_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payroll_batch_approval_actions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `payment_batch_id` BIGINT NOT NULL,
    `step_order` INTEGER NOT NULL,
    `action_by` BIGINT NOT NULL,
    `action` ENUM('APPROVED', 'REJECTED', 'RETURNED') NOT NULL,
    `comment` TEXT NULL,
    `action_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_payroll_batch_action_batch`(`payment_batch_id`),
    INDEX `idx_payroll_batch_action_step`(`step_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment_batch_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `payment_batch_id` BIGINT NOT NULL,
    `employee_id` BIGINT NOT NULL,
    `transaction_id` BIGINT NOT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'IN_REVIEW', 'MANAGER_APPROVED', 'APPROVED', 'REJECTED', 'REJECTED_BY_BRANCH_MANAGER', 'REJECTED_BY_SUPER_ADMIN') NOT NULL,
    `rejection_reason` TEXT NULL,
    `approved_by` BIGINT NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_batch_items_uuid_key`(`uuid`),
    INDEX `idx_payment_batch_item_batch`(`payment_batch_id`),
    INDEX `idx_payment_batch_item_employee`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Approval_workflows` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `workflow_name` VARCHAR(150) NOT NULL,
    `module_name` ENUM('PAYROLL', 'EMPLOYEE_TRANSFER', 'USER_TRANSFER') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Approval_workflows_uuid_key`(`uuid`),
    INDEX `idx_workflow_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Approval_workflow_steps` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `workflow_id` BIGINT NOT NULL,
    `step_order` INTEGER NOT NULL,
    `department_id` BIGINT NOT NULL,
    `role_id` BIGINT NOT NULL,
    `can_approve` BOOLEAN NOT NULL DEFAULT true,
    `can_reject` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_workflow_step_workflow`(`workflow_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Approval_requests` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `workflow_id` BIGINT NOT NULL,
    `reference_table` VARCHAR(100) NOT NULL,
    `reference_id` BIGINT NOT NULL,
    `current_step` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL,
    `initiated_by` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Approval_requests_uuid_key`(`uuid`),
    INDEX `idx_approval_request_workflow`(`workflow_id`),
    INDEX `idx_approval_request_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Approval_request_actions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `approval_request_id` BIGINT NOT NULL,
    `step_order` INTEGER NOT NULL,
    `action_by` BIGINT NOT NULL,
    `action` ENUM('APPROVED', 'REJECTED', 'RETURNED') NOT NULL,
    `comment` TEXT NULL,
    `action_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_approval_action_request`(`approval_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `employee_id` BIGINT NULL,
    `entity_table` VARCHAR(150) NOT NULL,
    `entity_id` BIGINT NOT NULL,
    `module_name` VARCHAR(100) NOT NULL,
    `activity_type` ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'FAILED_LOGIN') NOT NULL,
    `activity_description` TEXT NOT NULL,
    `action` ENUM('CREATED', 'UPDATED', 'DELETED', 'LOGIN', 'LOGOUT', 'APPROVED', 'DENIED') NOT NULL,
    `old_values` JSON NULL,
    `new_values` JSON NULL,
    `changed_fields` JSON NULL,
    `ip_address` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_audit_user`(`user_id`),
    INDEX `idx_audit_entity_table`(`entity_table`),
    INDEX `idx_audit_entity_id`(`entity_id`),
    INDEX `idx_audit_action`(`action`),
    INDEX `idx_audit_created`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Monthly_taxes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `rate` DECIMAL(5, 2) NOT NULL,
    `effective_from` DATE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Monthly_taxes_uuid_key`(`uuid`),
    INDEX `idx_monthly_tax_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `System_config` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `System_config_uuid_key`(`uuid`),
    UNIQUE INDEX `System_config_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User_sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `refresh_token_hash` TEXT NOT NULL,
    `device_info` TEXT NULL,
    `ip_address` VARCHAR(100) NULL,
    `is_revoked` BOOLEAN NOT NULL DEFAULT false,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_sessions_uuid_key`(`uuid`),
    INDEX `idx_user_session_user`(`user_id`),
    INDEX `idx_user_session_revoked`(`is_revoked`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transfer_requests` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `subject_type` ENUM('USER', 'EMPLOYEE') NOT NULL,
    `user_id` BIGINT NULL,
    `employee_id` BIGINT NULL,
    `old_working_location_id` BIGINT NULL,
    `new_working_location_id` BIGINT NOT NULL,
    `old_department_id` BIGINT NULL,
    `new_department_id` BIGINT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `current_level` VARCHAR(191) NULL DEFAULT 'BRANCH_MANAGER',
    `reason` TEXT NULL,
    `rejection_reason` TEXT NULL,
    `history` JSON NULL,
    `requested_by` BIGINT NOT NULL,
    `approved_by` BIGINT NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved_at` DATETIME(3) NULL,

    UNIQUE INDEX `Transfer_requests_uuid_key`(`uuid`),
    INDEX `idx_transfer_subject_type`(`subject_type`),
    INDEX `idx_transfer_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Notifications` ADD CONSTRAINT `Notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notifications` ADD CONSTRAINT `Notifications_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Working_locations` ADD CONSTRAINT `Working_locations_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Working_locations` ADD CONSTRAINT `Working_locations_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Working_locations` ADD CONSTRAINT `Working_locations_deleted_by_fkey` FOREIGN KEY (`deleted_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Branch_managers` ADD CONSTRAINT `Branch_managers_working_location_id_fkey` FOREIGN KEY (`working_location_id`) REFERENCES `Working_locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Branch_managers` ADD CONSTRAINT `Branch_managers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Branch_managers` ADD CONSTRAINT `Branch_managers_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Departments` ADD CONSTRAINT `Departments_working_location_id_fkey` FOREIGN KEY (`working_location_id`) REFERENCES `Working_locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Department_managers` ADD CONSTRAINT `Department_managers_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `Departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Department_managers` ADD CONSTRAINT `Department_managers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Department_managers` ADD CONSTRAINT `Department_managers_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Users` ADD CONSTRAINT `Users_working_location_id_fkey` FOREIGN KEY (`working_location_id`) REFERENCES `Working_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Users` ADD CONSTRAINT `Users_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `Departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_departments` ADD CONSTRAINT `User_departments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_departments` ADD CONSTRAINT `User_departments_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `Departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_roles` ADD CONSTRAINT `User_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_roles` ADD CONSTRAINT `User_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `Roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role_permissions` ADD CONSTRAINT `Role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `Roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role_permissions` ADD CONSTRAINT `Role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `Permissions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_permissions` ADD CONSTRAINT `User_permissions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_permissions` ADD CONSTRAINT `User_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `Permissions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_permissions` ADD CONSTRAINT `User_permissions_granted_by_fkey` FOREIGN KEY (`granted_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_permission_overrides` ADD CONSTRAINT `User_permission_overrides_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_permission_overrides` ADD CONSTRAINT `User_permission_overrides_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `Permissions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_permission_overrides` ADD CONSTRAINT `User_permission_overrides_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employees` ADD CONSTRAINT `Employees_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employees` ADD CONSTRAINT `Employees_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `Departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employees` ADD CONSTRAINT `Employees_working_location_id_fkey` FOREIGN KEY (`working_location_id`) REFERENCES `Working_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employees` ADD CONSTRAINT `Employees_employment_category_id_fkey` FOREIGN KEY (`employment_category_id`) REFERENCES `Employment_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_documents` ADD CONSTRAINT `Employee_documents_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `Employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_documents` ADD CONSTRAINT `Employee_documents_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_history` ADD CONSTRAINT `Employee_history_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `Employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_history` ADD CONSTRAINT `Employee_history_old_department_id_fkey` FOREIGN KEY (`old_department_id`) REFERENCES `Departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_history` ADD CONSTRAINT `Employee_history_new_department_id_fkey` FOREIGN KEY (`new_department_id`) REFERENCES `Departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_history` ADD CONSTRAINT `Employee_history_old_location_id_fkey` FOREIGN KEY (`old_location_id`) REFERENCES `Working_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_history` ADD CONSTRAINT `Employee_history_new_location_id_fkey` FOREIGN KEY (`new_location_id`) REFERENCES `Working_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_history` ADD CONSTRAINT `Employee_history_old_employment_category_id_fkey` FOREIGN KEY (`old_employment_category_id`) REFERENCES `Employment_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_history` ADD CONSTRAINT `Employee_history_new_employment_category_id_fkey` FOREIGN KEY (`new_employment_category_id`) REFERENCES `Employment_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_history` ADD CONSTRAINT `Employee_history_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_history` ADD CONSTRAINT `Employee_history_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment_structures` ADD CONSTRAINT `Payment_structures_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `Employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Allowances` ADD CONSTRAINT `Allowances_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `Employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_deductions` ADD CONSTRAINT `Employee_deductions_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `Employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee_deductions` ADD CONSTRAINT `Employee_deductions_deduction_type_id_fkey` FOREIGN KEY (`deduction_type_id`) REFERENCES `Deduction_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Time_records` ADD CONSTRAINT `Time_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `Employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Time_records` ADD CONSTRAINT `Time_records_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transactions` ADD CONSTRAINT `Transactions_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `Employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transactions` ADD CONSTRAINT `Transactions_payment_structure_id_fkey` FOREIGN KEY (`payment_structure_id`) REFERENCES `Payment_structures`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transactions` ADD CONSTRAINT `Transactions_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment_batches` ADD CONSTRAINT `Payment_batches_working_location_id_fkey` FOREIGN KEY (`working_location_id`) REFERENCES `Working_locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment_batches` ADD CONSTRAINT `Payment_batches_submitted_by_fkey` FOREIGN KEY (`submitted_by`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment_batches` ADD CONSTRAINT `Payment_batches_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payroll_batch_approval_actions` ADD CONSTRAINT `Payroll_batch_approval_actions_payment_batch_id_fkey` FOREIGN KEY (`payment_batch_id`) REFERENCES `Payment_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payroll_batch_approval_actions` ADD CONSTRAINT `Payroll_batch_approval_actions_action_by_fkey` FOREIGN KEY (`action_by`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment_batch_items` ADD CONSTRAINT `Payment_batch_items_payment_batch_id_fkey` FOREIGN KEY (`payment_batch_id`) REFERENCES `Payment_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment_batch_items` ADD CONSTRAINT `Payment_batch_items_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `Employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment_batch_items` ADD CONSTRAINT `Payment_batch_items_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `Transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment_batch_items` ADD CONSTRAINT `Payment_batch_items_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval_workflow_steps` ADD CONSTRAINT `Approval_workflow_steps_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `Approval_workflows`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval_workflow_steps` ADD CONSTRAINT `Approval_workflow_steps_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `Departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval_workflow_steps` ADD CONSTRAINT `Approval_workflow_steps_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `Roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval_requests` ADD CONSTRAINT `Approval_requests_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `Approval_workflows`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval_requests` ADD CONSTRAINT `Approval_requests_initiated_by_fkey` FOREIGN KEY (`initiated_by`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval_request_actions` ADD CONSTRAINT `Approval_request_actions_approval_request_id_fkey` FOREIGN KEY (`approval_request_id`) REFERENCES `Approval_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval_request_actions` ADD CONSTRAINT `Approval_request_actions_action_by_fkey` FOREIGN KEY (`action_by`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Audit_logs` ADD CONSTRAINT `Audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Audit_logs` ADD CONSTRAINT `Audit_logs_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `Employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_sessions` ADD CONSTRAINT `User_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer_requests` ADD CONSTRAINT `Transfer_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer_requests` ADD CONSTRAINT `Transfer_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `Employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer_requests` ADD CONSTRAINT `Transfer_requests_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer_requests` ADD CONSTRAINT `Transfer_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
