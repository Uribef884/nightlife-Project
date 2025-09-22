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
  // Security configurations to prevent blind SQL injection
  extra: {
    // Connection timeout controls - optimized for high-volume operations
    connectionTimeoutMillis: 10000, // 10 second connection timeout (increased)
    query_timeout: 30000, // 30 second query timeout (increased for complex operations)
    statement_timeout: 30000, // 30 second statement timeout
    
    // Connection pooling limits - optimized for high-volume read/write operations
    max: 50, // Maximum number of connections in pool (increased)
    min: 10, // Minimum number of connections in pool (increased)
    acquireTimeoutMillis: 120000, // 2 minute acquire timeout (increased)
    idleTimeoutMillis: 60000, // 1 minute idle timeout (increased)
    createTimeoutMillis: 60000, // 1 minute create timeout (increased)
    destroyTimeoutMillis: 10000, // 10 second destroy timeout (increased)
    
    // Performance optimizations
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
    
    // Additional security settings
    application_name: 'nightlife-backend',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
});
