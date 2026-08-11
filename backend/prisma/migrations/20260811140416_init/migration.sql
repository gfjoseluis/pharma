-- CreateTable
CREATE TABLE `Branch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'pequena',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Branch_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'cajero',
    `branchId` INTEGER NULL,
    `permissions` JSON NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Category_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Laboratory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Laboratory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UnitMeasure` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `UnitMeasure_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `ruc` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Supplier_ruc_key`(`ruc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `barcode` VARCHAR(191) NULL,
    `categoryId` INTEGER NULL,
    `laboratoryId` INTEGER NULL,
    `unitMeasureId` INTEGER NULL,
    `presentation` VARCHAR(191) NOT NULL DEFAULT 'unidad',
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `costPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `minStock` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Product_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductSupplier` (
    `productId` INTEGER NOT NULL,
    `supplierId` INTEGER NOT NULL,

    PRIMARY KEY (`productId`, `supplierId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Stock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branchId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `lot` VARCHAR(191) NULL,
    `expiryDate` DATETIME(3) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Stock_branchId_productId_lot_key`(`branchId`, `productId`, `lot`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `productId` INTEGER NOT NULL,
    `branchId` INTEGER NOT NULL,
    `targetBranchId` INTEGER NULL,
    `quantity` INTEGER NOT NULL,
    `lot` VARCHAR(191) NULL,
    `userId` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Purchase` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoiceNumber` VARCHAR(191) NULL,
    `supplierId` INTEGER NULL,
    `branchId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `total` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'RECIBIDA',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitCost` DECIMAL(10, 2) NOT NULL,
    `lot` VARCHAR(191) NULL,
    `expiryDate` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `ciNit` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Client_ciNit_key`(`ciNit`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `branchId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `clientId` INTEGER NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'SIMPLE',
    `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'PAID',
    `total` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Sale_number_key`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SaleItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `sinNumber` VARCHAR(191) NULL,
    `cuf` VARCHAR(191) NULL,
    `controlCode` VARCHAR(191) NULL,
    `saleId` INTEGER NULL,
    `clientId` INTEGER NULL,
    `branchId` INTEGER NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ISSUED',
    `xmlUrl` VARCHAR(191) NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `annulledAt` DATETIME(3) NULL,
    `reason` VARCHAR(191) NULL,

    UNIQUE INDEX `Invoice_number_key`(`number`),
    UNIQUE INDEX `Invoice_sinNumber_key`(`sinNumber`),
    UNIQUE INDEX `Invoice_cuf_key`(`cuf`),
    UNIQUE INDEX `Invoice_saleId_key`(`saleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `License` (
    `id` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'INACTIVE',
    `license_key` VARCHAR(191) NULL,
    `activatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `License_module_key`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Backup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'RUNNING',
    `filename` VARCHAR(191) NULL,
    `path` VARCHAR(191) NULL,
    `sizeBytes` BIGINT NULL,
    `error` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_laboratoryId_fkey` FOREIGN KEY (`laboratoryId`) REFERENCES `Laboratory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_unitMeasureId_fkey` FOREIGN KEY (`unitMeasureId`) REFERENCES `UnitMeasure`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSupplier` ADD CONSTRAINT `ProductSupplier_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSupplier` ADD CONSTRAINT `ProductSupplier_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stock` ADD CONSTRAINT `Stock_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stock` ADD CONSTRAINT `Stock_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseItem` ADD CONSTRAINT `PurchaseItem_purchaseId_fkey` FOREIGN KEY (`purchaseId`) REFERENCES `Purchase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseItem` ADD CONSTRAINT `PurchaseItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
