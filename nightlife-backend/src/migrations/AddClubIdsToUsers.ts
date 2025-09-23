import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClubIdsToUsers1700000000000 implements MigrationInterface {
    name = 'AddClubIdsToUsers1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add club_ids column
        await queryRunner.query(`
            ALTER TABLE "user" 
            ADD COLUMN "club_ids" text[] NOT NULL DEFAULT '{}'::text[]
        `);

        // Add index for performance
        await queryRunner.query(`
            CREATE INDEX "IDX_user_club_ids" ON "user" USING GIN ("club_ids")
        `);

        // Backfill existing clubId into club_ids
        await queryRunner.query(`
            UPDATE "user" 
            SET "club_ids" = ARRAY["clubId"] 
            WHERE "clubId" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop index
        await queryRunner.query(`DROP INDEX "IDX_user_club_ids"`);
        
        // Drop column
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "club_ids"`);
    }
}
