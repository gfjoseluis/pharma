-- DropForeignKey
ALTER TABLE `invoice` DROP FOREIGN KEY `Invoice_branchId_fkey`;

-- DropForeignKey
ALTER TABLE `invoice` DROP FOREIGN KEY `Invoice_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `invoice` DROP FOREIGN KEY `Invoice_saleId_fkey`;

-- AlterTable
ALTER TABLE `category` ADD COLUMN `description` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `product` DROP COLUMN `activeIngredient`,
    DROP COLUMN `presentation`,
    ADD COLUMN `concentration` VARCHAR(191) NULL,
    ADD COLUMN `formId` INTEGER NULL,
    ADD COLUMN `restrictedUse` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `purchase` DROP COLUMN `status`;

-- DropTable
DROP TABLE `invoice`;

-- CreateTable
CREATE TABLE `Form` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Form_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductActiveIngredient` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `ingredient` VARCHAR(191) NOT NULL,
    `concentration` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductRestriction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `restrictionType` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `Form`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductActiveIngredient` ADD CONSTRAINT `ProductActiveIngredient_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductRestriction` ADD CONSTRAINT `ProductRestriction_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

