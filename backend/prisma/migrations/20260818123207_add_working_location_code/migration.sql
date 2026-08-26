-- AlterTable
ALTER TABLE `working_locations` ADD COLUMN `code` VARCHAR(12) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Working_locations_code_key` ON `working_locations`(`code`);
