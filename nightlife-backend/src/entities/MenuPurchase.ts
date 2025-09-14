import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { MenuItem } from "./MenuItem";
import { MenuItemVariant } from "./MenuItemVariant";
import { User } from "./User";
import { Club } from "./Club";
import { UnifiedPurchaseTransaction } from "./UnifiedPurchaseTransaction";

@Entity()
export class MenuPurchase {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => MenuItem, { eager: true })
  @JoinColumn({ name: "menuItemId" })
  menuItem!: MenuItem;

  @Column()
  menuItemId!: string;

  @ManyToOne(() => MenuItemVariant, { eager: true, nullable: true })
  @JoinColumn({ name: "variantId" })
  variant?: MenuItemVariant;

  @Column({ nullable: true })
  variantId?: string;

  @Column({ type: "varchar", nullable: true, default: null })
  userId!: string | null;

  @Column({ type: "varchar", nullable: true, default: null })
  sessionId!: string | null;

  @ManyToOne(() => Club)
  @JoinColumn({ name: "clubId" })
  club!: Club;

  @Column()
  clubId!: string;

  @Column({ type: 'date', nullable: true })
  date?: Date; // date for which the menu item was purchased

  @Column()
  email!: string;


  @Column({ default: false })
  isUsed!: boolean;

  @Column({ type: "timestamp", nullable: true })
  usedAt?: Date;

  @Column({ default: 1 })
  quantity!: number;

  // 🎯 Individual menu item pricing information
  @Column('decimal')
  originalBasePrice!: number;

  @Column('decimal')
  priceAtCheckout!: number;

  @Column({ default: false })
  dynamicPricingWasApplied!: boolean;

  @Column({ type: "varchar", nullable: true })
  dynamicPricingReason?: string; // e.g., "early_bird", "closed_day"

  @Column('decimal')
  clubReceives!: number; // What the club gets for this specific menu item

  // 🎯 Individual menu item fees (proportional to this item's price)
  @Column('decimal')
  platformFee!: number; // Platform fee for this specific menu item

  @Column('decimal')
  platformFeeApplied!: number; // Platform fee percentage applied

  @ManyToOne(() => UnifiedPurchaseTransaction)
  @JoinColumn({ name: "transactionId" })
  transaction!: UnifiedPurchaseTransaction;

  @Column()
  transactionId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
