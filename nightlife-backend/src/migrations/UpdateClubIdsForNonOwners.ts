import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateClubIdsForNonOwners1700000000001 implements MigrationInterface {
    name = 'UpdateClubIdsForNonOwners1700000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, modify the column to allow NULL values
        await queryRunner.query(`
            ALTER TABLE "user" 
            ALTER COLUMN "club_ids" DROP NOT NULL
        `);
        
        // Then set club_ids to NULL for non-club owners
        await queryRunner.query(`
            UPDATE "user" 
            SET "club_ids" = NULL 
            WHERE "role" != 'clubowner'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert: Set empty array for non-club owners
        await queryRunner.query(`
            UPDATE "user" 
            SET "club_ids" = '{}'::text[]
            WHERE "role" != 'clubowner'
        `);
        
        // Then make the column NOT NULL again
        await queryRunner.query(`
            ALTER TABLE "user" 
            ALTER COLUMN "club_ids" SET NOT NULL
        `);
    }
}
