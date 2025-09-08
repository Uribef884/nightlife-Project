import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./User";
import { Ticket } from "./Ticket";
import { MenuItem } from "./MenuItem";
import { MenuItemVariant } from "./MenuItemVariant";

@Entity("unified_cart_item")
export class UnifiedCartItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  sessionId?: string;

  @Column()
  clubId!: string;

  @Column({ type: "enum", enum: ["ticket", "menu"] })
  itemType!: "ticket" | "menu";

  @Column({ nullable: true })
  ticketId?: string;

  @Column({ type: "date", nullable: true })
  date?: Date;

  @Column({ nullable: true })
  menuItemId?: string;

  @Column({ nullable: true })
  variantId?: string;

  @Column({ type: "int" })
  quantity!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "userId" })
  user?: User;

  @ManyToOne(() => Ticket, { nullable: true })
  @JoinColumn({ name: "ticketId" })
  ticket?: Ticket;

  @ManyToOne(() => MenuItem, { nullable: true })
  @JoinColumn({ name: "menuItemId" })
  menuItem?: MenuItem;

  @ManyToOne(() => MenuItemVariant, { nullable: true })
  @JoinColumn({ name: "variantId" })
  variant?: MenuItemVariant;
}

