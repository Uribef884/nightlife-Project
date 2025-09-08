import { MigrationInterface, QueryRunner, Table, Index } from "typeorm";

export class AddUnifiedCartAndTransaction1734567890123 implements MigrationInterface {
    name = 'AddUnifiedCartAndTransaction1734567890123'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create unified_cart_item table
        await queryRunner.createTable(
            new Table({
                name: "unified_cart_item",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()"
                    },
                    {
                        name: "userId",
                        type: "varchar",
                        isNullable: true,
                        default: null
                    },
                    {
                        name: "sessionId",
                        type: "varchar",
                        isNullable: true,
                        default: null
                    },
                    {
                        name: "clubId",
                        type: "varchar",
                        isNullable: false
                    },
                    {
                        name: "itemType",
                        type: "enum",
                        enum: ["ticket", "menu"],
                        isNullable: false
                    },
                    {
                        name: "ticketId",
                        type: "varchar",
                        isNullable: true
                    },
                    {
                        name: "date",
                        type: "date",
                        isNullable: true
                    },
                    {
                        name: "menuItemId",
                        type: "varchar",
                        isNullable: true
                    },
                    {
                        name: "variantId",
                        type: "varchar",
                        isNullable: true
                    },
                    {
                        name: "quantity",
                        type: "int",
                        isNullable: false
                    },
                    {
                        name: "createdAt",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP"
                    },
                    {
                        name: "updatedAt",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP"
                    }
                ],
                foreignKeys: [
                    {
                        columnNames: ["ticketId"],
                        referencedTableName: "ticket",
                        referencedColumnNames: ["id"],
                        onDelete: "CASCADE"
                    },
                    {
                        columnNames: ["menuItemId"],
                        referencedTableName: "menu_item",
                        referencedColumnNames: ["id"],
                        onDelete: "CASCADE"
                    },
                    {
                        columnNames: ["variantId"],
                        referencedTableName: "menu_item_variant",
                        referencedColumnNames: ["id"],
                        onDelete: "CASCADE"
                    }
                ]
            }),
            true
        );

        // Create unified_purchase_transaction table
        await queryRunner.createTable(
            new Table({
                name: "unified_purchase_transaction",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()"
                    },
                    {
                        name: "userId",
                        type: "varchar",
                        isNullable: true
                    },
                    {
                        name: "clubId",
                        type: "varchar",
                        isNullable: false
                    },
                    {
                        name: "buyerEmail",
                        type: "varchar",
                        isNullable: false
                    },
                    {
                        name: "ticketDate",
                        type: "date",
                        isNullable: true
                    },
                    {
                        name: "totalPaid",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: "ticketSubtotal",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: "menuSubtotal",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: "platformReceives",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: "clubReceives",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: "gatewayFee",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: "gatewayIVA",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: "retencionICA",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: true
                    },
                    {
                        name: "retencionIVA",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: true
                    },
                    {
                        name: "retencionFuente",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: true
                    },
                    {
                        name: "platformFeeAppliedTickets",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: "platformFeeAppliedMenu",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: "paymentProvider",
                        type: "varchar",
                        default: "'wompi'"
                    },
                    {
                        name: "paymentProviderTransactionId",
                        type: "varchar",
                        isNullable: true,
                        isUnique: true
                    },
                    {
                        name: "paymentProviderReference",
                        type: "varchar",
                        isNullable: true
                    },
                    {
                        name: "paymentStatus",
                        type: "varchar",
                        default: "'PENDING'"
                    },
                    {
                        name: "customerFullName",
                        type: "varchar",
                        isNullable: true
                    },
                    {
                        name: "customerPhoneNumber",
                        type: "varchar",
                        isNullable: true
                    },
                    {
                        name: "customerLegalId",
                        type: "varchar",
                        isNullable: true
                    },
                    {
                        name: "customerLegalIdType",
                        type: "varchar",
                        isNullable: true
                    },
                    {
                        name: "paymentMethod",
                        type: "varchar",
                        isNullable: true
                    },
                    {
                        name: "createdAt",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP"
                    },
                    {
                        name: "updatedAt",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP"
                    }
                ],
                foreignKeys: [
                    {
                        columnNames: ["userId"],
                        referencedTableName: "user",
                        referencedColumnNames: ["id"],
                        onDelete: "SET NULL"
                    }
                ]
            }),
            true
        );

        // Create unified_purchase_line_item table
        await queryRunner.createTable(
            new Table({
                name: "unified_purchase_line_item",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()"
                    },
                    {
                        name: "transactionId",
                        type: "uuid",
                        isNullable: false
                    },
                    {
                        name: "type",
                        type: "enum",
                        enum: ["ticket", "menu"],
                        isNullable: false
                    },
                    {
                        name: "ticketPurchaseId",
                        type: "uuid",
                        isNullable: true
                    },
                    {
                        name: "menuPurchaseId",
                        type: "uuid",
                        isNullable: true
                    },
                    {
                        name: "unitPrice",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: "quantity",
                        type: "int",
                        isNullable: false
                    },
                    {
                        name: "subtotal",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                        isNullable: false
                    },
                    {
                        name: "clubId",
                        type: "varchar",
                        isNullable: false
                    },
                    {
                        name: "createdAt",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP"
                    }
                ],
                foreignKeys: [
                    {
                        columnNames: ["transactionId"],
                        referencedTableName: "unified_purchase_transaction",
                        referencedColumnNames: ["id"],
                        onDelete: "CASCADE"
                    },
                    {
                        columnNames: ["ticketPurchaseId"],
                        referencedTableName: "ticket_purchase",
                        referencedColumnNames: ["id"],
                        onDelete: "CASCADE"
                    },
                    {
                        columnNames: ["menuPurchaseId"],
                        referencedTableName: "menu_purchase",
                        referencedColumnNames: ["id"],
                        onDelete: "CASCADE"
                    }
                ]
            }),
            true
        );

        // Create indexes for performance using raw SQL
        await queryRunner.query(`CREATE INDEX "idx_unified_cart_user" ON "unified_cart_item" ("userId")`);
        await queryRunner.query(`CREATE INDEX "idx_unified_cart_session" ON "unified_cart_item" ("sessionId")`);
        await queryRunner.query(`CREATE INDEX "idx_unified_cart_club" ON "unified_cart_item" ("clubId")`);
        await queryRunner.query(`CREATE INDEX "idx_unified_cart_type" ON "unified_cart_item" ("itemType")`);

        await queryRunner.query(`CREATE INDEX "idx_unified_paymentProviderReference" ON "unified_purchase_transaction" ("paymentProviderReference")`);
        await queryRunner.query(`CREATE INDEX "idx_unified_paymentProviderTransactionId" ON "unified_purchase_transaction" ("paymentProviderTransactionId")`);
        await queryRunner.query(`CREATE INDEX "idx_unified_user" ON "unified_purchase_transaction" ("userId")`);
        await queryRunner.query(`CREATE INDEX "idx_unified_club" ON "unified_purchase_transaction" ("clubId")`);

        await queryRunner.query(`CREATE INDEX "idx_unified_line_transaction" ON "unified_purchase_line_item" ("transactionId")`);
        await queryRunner.query(`CREATE INDEX "idx_unified_line_type" ON "unified_purchase_line_item" ("type")`);
        await queryRunner.query(`CREATE INDEX "idx_unified_line_club" ON "unified_purchase_line_item" ("clubId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes first
        await queryRunner.dropIndex("unified_purchase_line_item", "idx_unified_line_club");
        await queryRunner.dropIndex("unified_purchase_line_item", "idx_unified_line_type");
        await queryRunner.dropIndex("unified_purchase_line_item", "idx_unified_line_transaction");

        await queryRunner.dropIndex("unified_purchase_transaction", "idx_unified_club");
        await queryRunner.dropIndex("unified_purchase_transaction", "idx_unified_user");
        await queryRunner.dropIndex("unified_purchase_transaction", "idx_unified_paymentProviderTransactionId");
        await queryRunner.dropIndex("unified_purchase_transaction", "idx_unified_paymentProviderReference");

        await queryRunner.dropIndex("unified_cart_item", "idx_unified_cart_type");
        await queryRunner.dropIndex("unified_cart_item", "idx_unified_cart_club");
        await queryRunner.dropIndex("unified_cart_item", "idx_unified_cart_session");
        await queryRunner.dropIndex("unified_cart_item", "idx_unified_cart_user");

        // Drop tables
        await queryRunner.dropTable("unified_purchase_line_item");
        await queryRunner.dropTable("unified_purchase_transaction");
        await queryRunner.dropTable("unified_cart_item");
    }
}
