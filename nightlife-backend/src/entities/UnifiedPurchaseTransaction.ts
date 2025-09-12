import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { User } from './User';
import { TicketPurchase } from './TicketPurchase';
import { MenuPurchase } from './MenuPurchase';

@Entity()
export class UnifiedPurchaseTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "userId" })
  user?: User;

  @Column({ nullable: true })
  userId?: string;

  @Column()
  clubId!: string;

  @Column()
  buyerEmail!: string; // for anonymous delivery of QRs

  @Column({ type: 'date', nullable: true })
  ticketDate?: Date; // applies to ticket lines

  // Financial (totals and category splits)
  @Column('decimal')
  totalPaid!: number;

  @Column('decimal')
  ticketSubtotal!: number; // sum of ticket prices

  @Column('decimal')
  menuSubtotal!: number;

  @Column('decimal')
  platformReceives!: number; // total

  @Column('decimal')
  clubReceives!: number; // total

  @Column('decimal')
  gatewayFee!: number; // total

  @Column('decimal')
  gatewayIVA!: number; // total

  @Column('decimal', { nullable: true })
  retencionICA?: number;

  @Column('decimal', { nullable: true })
  retencionIVA?: number;

  @Column('decimal', { nullable: true })
  retencionFuente?: number;

  @Column('decimal')
  platformFeeAppliedTickets!: number; // 5% of ticket subtotal

  @Column('decimal')
  platformFeeAppliedMenu!: number; // 2.5% of menu subtotal

  // Payment tracking
  @Column({ default: "wompi" })
  paymentProvider!: "wompi" | "mock" | "free";

  @Column({ nullable: true, unique: true })
  paymentProviderTransactionId?: string;

  @Index("idx_unified_paymentProviderReference")
  @Column({ nullable: true })
  paymentProviderReference?: string;

  @Column({ default: "PENDING" })
  paymentStatus!: "APPROVED" | "DECLINED" | "PENDING" | "VOIDED" | "ERROR";

  // Enhanced customer information for better UX and compliance
  @Column({ nullable: true })
  customerFullName?: string;

  @Column({ nullable: true })
  customerPhoneNumber?: string;

  @Column({ nullable: true })
  customerLegalId?: string;

  @Column({ nullable: true })
  customerLegalIdType?: string;

  @Column({ nullable: true })
  paymentMethod?: string;

  @Column('text', { nullable: true })
  qrPayload?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date | null;

  @OneToMany(() => TicketPurchase, ticketPurchase => ticketPurchase.transaction)
  ticketPurchases!: TicketPurchase[];

  @OneToMany(() => MenuPurchase, menuPurchase => menuPurchase.transaction)
  menuPurchases!: MenuPurchase[];
}

