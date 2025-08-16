import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { TicketPurchase } from "./TicketPurchase";
import { User } from "./User";

@Entity()
export class PurchaseTransaction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "userId" })
  user?: User;

  @Column({ nullable: true }) // ✅ Required for anonymous checkout to work properly
  userId?: string;

  @Column()
  clubId!: string;

  @Column()
  email!: string; // ✅ DO NOT leave optional — must be defined

  @Column({ type: 'date' })
  date!: Date;

  @Column("numeric")
  totalPaid!: number;

  @Column("numeric")
  clubReceives!: number;

  @Column("numeric")
  platformReceives!: number;

  @Column("numeric")
  gatewayFee!: number;

  @Column("numeric")
  gatewayIVA!: number;

  @Column("numeric", { nullable: true })
  retentionICA?: number;

  @Column("numeric", { nullable: true })
  retentionIVA?: number;

  @Column("numeric", { nullable: true })
  retentionFuente?: number;

  @Column({ nullable: true, unique: true })
  paymentProviderTransactionId?: string; // Wompi or mock_txn_xxxx

  @Column({ default: "mock" })
  paymentProvider!: "mock" | "wompi" | "free";

  @Index("idx_ticket_paymentProviderReference")
  @Column({ nullable: true })
  paymentProviderReference?: string;

  @Column({ default: "PENDING" }) 
  paymentStatus!: "APPROVED" | "DECLINED" | "PENDING" | "VOIDED";

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => TicketPurchase, (purchase) => purchase.transaction)
  purchases!: TicketPurchase[];

}
