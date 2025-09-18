import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIncludedItemsToTicketPurchase1758145343549 implements MigrationInterface {
    name = 'AddIncludedItemsToTicketPurchase1758145343549'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_purchase" ADD "hasIncludedItems" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "ticket_purchase" ADD "includedQrCodeEncrypted" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_purchase" DROP COLUMN "includedQrCodeEncrypted"`);
        await queryRunner.query(`ALTER TABLE "ticket_purchase" DROP COLUMN "hasIncludedItems"`);
    }

}
