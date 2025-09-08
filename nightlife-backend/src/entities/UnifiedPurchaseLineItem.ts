import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { UnifiedPurchaseTransaction } from './UnifiedPurchaseTransaction';
import { TicketPurchase } from './TicketPurchase';
import { MenuPurchase } from './MenuPurchase';

@Entity()
export class UnifiedPurchaseLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => UnifiedPurchaseTransaction, transaction => transaction.lineItems)
  @JoinColumn({ name: "transactionId" })
  transaction!: UnifiedPurchaseTransaction;

  @Column()
  transactionId!: string;

  @Column({ type: "enum", enum: ["ticket", "menu"] })
  type!: "ticket" | "menu";

  // Bridge to existing purchase entities
  @ManyToOne(() => TicketPurchase, { nullable: true })
  @JoinColumn({ name: "ticketPurchaseId" })
  ticketPurchase?: TicketPurchase;

  @Column({ nullable: true })
  ticketPurchaseId?: string;

  @ManyToOne(() => MenuPurchase, { nullable: true })
  @JoinColumn({ name: "menuPurchaseId" })
  menuPurchase?: MenuPurchase;

  @Column({ nullable: true })
  menuPurchaseId?: string;

  @Column('decimal')
  unitPrice!: number; // final price used

  @Column('int')
  quantity!: number;

  @Column('decimal')
  subtotal!: number; // unitPrice * qty

  @Column()
  clubId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

