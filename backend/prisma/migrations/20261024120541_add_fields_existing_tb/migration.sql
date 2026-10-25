-- AlterTable
ALTER TABLE `EmailDeliveries` ADD COLUMN `processing_started_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `OutboxEvents` ADD COLUMN `locked_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `OutboxEvents_status_locked_at_idx` ON `OutboxEvents`(`status`, `locked_at`);
