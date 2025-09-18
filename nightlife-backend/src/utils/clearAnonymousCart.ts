import { AppDataSource } from "../config/data-source";
import { UnifiedCartItem } from "../entities/UnifiedCartItem";

export async function clearAnonymousCart(sessionId?: string): Promise<void> {
  if (!sessionId) return;

  const unifiedRepo = AppDataSource.getRepository(UnifiedCartItem);
  await unifiedRepo.delete({ sessionId });
}