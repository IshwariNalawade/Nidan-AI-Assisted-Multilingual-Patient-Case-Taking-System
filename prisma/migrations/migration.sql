-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('PATIENT', 'DOCTOR', 'STAFF') NOT NULL DEFAULT 'PATIENT';

-- AlterTable
ALTER TABLE `Assessment` ADD COLUMN `draftData` JSON NULL,
    ADD COLUMN `triageNotes` TEXT NULL,
    ADD COLUMN `triageStatus` ENUM('PENDING', 'TRIAGED', 'REFERRED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `triagedAt` DATETIME(3) NULL,
    ADD COLUMN `triagedById` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Assessment_triageStatus_status_submittedAt_idx` ON `Assessment`(`triageStatus`, `status`, `submittedAt`);

-- AddForeignKey
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_triagedById_fkey` FOREIGN KEY (`triagedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
