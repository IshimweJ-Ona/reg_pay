/*
  Warnings:

  - A unique constraint covering the columns `[first_name,last_name,working_location_id,department_id]` on the table `Employees` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `payment_batch_items` MODIFY `status` ENUM('DRAFT', 'PENDING', 'IN_REVIEW', 'MANAGER_APPROVED', 'APPROVED', 'REJECTED', 'REJECTED_BY_BRANCH_MANAGER', 'REJECTED_BY_SUPER_ADMIN') NOT NULL;

-- AlterTable
ALTER TABLE `payment_batches` MODIFY `status` ENUM('DRAFT', 'PENDING', 'IN_REVIEW', 'MANAGER_APPROVED', 'APPROVED', 'REJECTED', 'REJECTED_BY_BRANCH_MANAGER', 'REJECTED_BY_SUPER_ADMIN') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Employees_first_name_last_name_working_location_id_departmen_key` ON `Employees`(`first_name`, `last_name`, `working_location_id`, `department_id`);
