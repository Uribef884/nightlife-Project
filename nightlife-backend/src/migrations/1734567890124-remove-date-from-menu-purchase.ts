import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveDateFromMenuPurchase1734567890124 implements MigrationInterface {
    name = 'RemoveDateFromMenuPurchase1734567890124'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "menu_purchase" DROP COLUMN "date"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "menu_purchase" ADD "date" date NOT NULL`);
    }
}
