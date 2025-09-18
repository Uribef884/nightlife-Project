import { DataSource } from "typeorm";
import { Club } from "../entities/Club";
import { Ticket } from "../entities/Ticket";
import { TicketPurchase } from "../entities/TicketPurchase";
import { User } from "../entities/User";
import { Event } from "../entities/Event";
import dotenv from "dotenv";
import { MenuCategory } from "../entities/MenuCategory";
import { MenuItem } from "../entities/MenuItem";
import { MenuItemVariant } from "../entities/MenuItemVariant";
import { MenuPurchase } from "../entities/MenuPurchase";
import { TicketIncludedMenuItem } from "../entities/TicketIncludedMenuItem";
import { MenuItemFromTicket } from "../entities/MenuItemFromTicket";
import { Ad } from "../entities/Ad";
import { UnifiedCartItem } from "../entities/UnifiedCartItem";
import { UnifiedPurchaseTransaction } from "../entities/UnifiedPurchaseTransaction";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  synchronize: false,  // Disable auto-sync when using migrations
  logging: false,
  migrations: ["src/migrations/*.ts"],
  entities: [
    Club, 
    Ticket, 
    TicketPurchase, 
    User, 
    Event,
    Ad,
    MenuCategory, 
    MenuItem, 
    MenuItemVariant, 
    MenuPurchase, 
    TicketIncludedMenuItem,
    MenuItemFromTicket,
    UnifiedCartItem,
    UnifiedPurchaseTransaction,
  ],
});
