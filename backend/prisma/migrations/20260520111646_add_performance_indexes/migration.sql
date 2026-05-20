-- CreateIndex
CREATE INDEX `idx_employee_first_name` ON `Employees`(`first_name`);

-- CreateIndex
CREATE INDEX `idx_employee_last_name` ON `Employees`(`last_name`);

-- CreateIndex
CREATE INDEX `idx_employee_email` ON `Employees`(`email`);

-- CreateIndex
CREATE INDEX `idx_employee_phone` ON `Employees`(`phone_number`);

-- CreateIndex
CREATE INDEX `idx_employee_national_id` ON `Employees`(`national_id`);

-- CreateIndex
CREATE INDEX `idx_user_first_name` ON `Users`(`first_name`);

-- CreateIndex
CREATE INDEX `idx_user_last_name` ON `Users`(`last_name`);
