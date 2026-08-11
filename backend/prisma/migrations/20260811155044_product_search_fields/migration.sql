-- AlterTable
ALTER TABLE `product` ADD COLUMN `activeIngredient` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `purchaseitem` ADD COLUMN `laboratoryId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `PurchaseItem` ADD CONSTRAINT `PurchaseItem_laboratoryId_fkey` FOREIGN KEY (`laboratoryId`) REFERENCES `Laboratory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
