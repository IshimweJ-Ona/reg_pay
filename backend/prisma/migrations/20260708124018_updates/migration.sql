/*
  Warnings:

  - You are about to alter the column `phone_number` on the `employees` table. The data in that column could be lost. The data in that column will be cast from `VarChar(20)` to `VarChar(15)`.
  - You are about to alter the column `national_id` on the `employees` table. The data in that column could be lost. The data in that column will be cast from `VarChar(50)` to `VarChar(16)`.

*/
-- AlterTable
ALTER TABLE `employees` MODIFY `phone_number` VARCHAR(15) NULL,
    MODIFY `national_id` VARCHAR(16) NULL;
