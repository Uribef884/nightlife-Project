// src/utils/secureQuery.ts
import { Repository, EntityTarget, FindOptionsWhere, FindManyOptions, FindOneOptions, ObjectLiteral } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { monitorQuery } from './queryMonitor';

interface QueryContext {
  userId?: string;
  sessionId?: string;
  operation: string;
}

/**
 * Secure query wrapper that adds monitoring and timeout protection
 */
export class SecureQuery {
  /**
   * Secure findOne operation with monitoring
   */
  static async findOne<T extends ObjectLiteral>(
    repository: Repository<T>,
    options: FindOneOptions<T>,
    context: QueryContext
  ): Promise<T | null> {
    return monitorQuery(
      `${context.operation}_findOne`,
      async () => {
        return await repository.findOne(options);
      },
      {
        userId: context.userId,
        sessionId: context.sessionId,
        queryHash: this.generateQueryHash(options)
      }
    );
  }

  /**
   * Secure find operation with monitoring
   */
  static async find<T extends ObjectLiteral>(
    repository: Repository<T>,
    options: FindManyOptions<T>,
    context: QueryContext
  ): Promise<T[]> {
    return monitorQuery(
      `${context.operation}_find`,
      async () => {
        return await repository.find(options);
      },
      {
        userId: context.userId,
        sessionId: context.sessionId,
        queryHash: this.generateQueryHash(options)
      }
    );
  }

  /**
   * Secure save operation with monitoring
   */
  static async save<T extends ObjectLiteral>(
    repository: Repository<T>,
    entity: T | T[],
    context: QueryContext
  ): Promise<T | T[]> {
    return monitorQuery(
      `${context.operation}_save`,
      async () => {
        if (Array.isArray(entity)) {
          return await repository.save(entity);
        } else {
          return await repository.save(entity);
        }
      },
      {
        userId: context.userId,
        sessionId: context.sessionId,
        queryHash: this.generateQueryHash(entity)
      }
    );
  }

  /**
   * Secure delete operation with monitoring
   */
  static async delete<T extends ObjectLiteral>(
    repository: Repository<T>,
    criteria: FindOptionsWhere<T>,
    context: QueryContext
  ): Promise<{ affected?: number }> {
    return monitorQuery(
      `${context.operation}_delete`,
      async () => {
        const result = await repository.delete(criteria);
        return { affected: result.affected || 0 };
      },
      {
        userId: context.userId,
        sessionId: context.sessionId,
        queryHash: this.generateQueryHash(criteria)
      }
    );
  }

  /**
   * Secure raw query with parameterized values
   */
  static async rawQuery<T = any>(
    query: string,
    parameters: any[],
    context: QueryContext
  ): Promise<T[]> {
    // Validate query doesn't contain dangerous patterns
    this.validateQuery(query);

    return monitorQuery(
      `${context.operation}_rawQuery`,
      async () => {
        return await AppDataSource.query(query, parameters);
      },
      {
        userId: context.userId,
        sessionId: context.sessionId,
        queryHash: this.generateQueryHash({ query, parameters })
      }
    );
  }

  /**
   * Secure count operation with monitoring
   */
  static async count<T extends ObjectLiteral>(
    repository: Repository<T>,
    options: FindManyOptions<T>,
    context: QueryContext
  ): Promise<number> {
    return monitorQuery(
      `${context.operation}_count`,
      async () => {
        return await repository.count(options);
      },
      {
        userId: context.userId,
        sessionId: context.sessionId,
        queryHash: this.generateQueryHash(options)
      }
    );
  }

  /**
   * Generate a hash for query identification
   */
  private static generateQueryHash(query: any): string {
    try {
      const queryString = JSON.stringify(query);
      return Buffer.from(queryString).toString('base64').substring(0, 16);
    } catch {
      return 'unknown';
    }
  }

  /**
   * Validate raw query for dangerous patterns
   */
  private static validateQuery(query: string): void {
    const dangerousPatterns = [
      /--/g, // SQL comments
      /\/\*/g, // Block comments
      /union\s+select/gi, // Union select
      /drop\s+table/gi, // Drop table
      /delete\s+from/gi, // Delete from
      /insert\s+into/gi, // Insert into
      /update\s+set/gi, // Update set
      /exec\s*\(/gi, // Exec function
      /sp_/gi, // Stored procedures
      /xp_/gi, // Extended procedures
      /waitfor\s+delay/gi, // Time-based attacks
      /benchmark\s*\(/gi, // Benchmark function
      /sleep\s*\(/gi, // Sleep function
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        throw new Error(`Potentially dangerous query pattern detected: ${pattern.source}`);
      }
    }

    // Check for parameterized query usage
    if (!query.includes('$') && !query.includes('?')) {
      console.warn('[SECURE-QUERY] Raw query without parameters detected', { query });
    }
  }

  /**
   * Get repository with monitoring
   */
  static getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return AppDataSource.getRepository(entity);
  }
}

/**
 * Utility function to create query context
 */
export function createQueryContext(
  operation: string,
  userId?: string,
  sessionId?: string
): QueryContext {
  return {
    operation,
    userId,
    sessionId
  };
}

/**
 * Wrapper for common query patterns
 */
export const secureQuery = {
  findOne: SecureQuery.findOne,
  find: SecureQuery.find,
  save: SecureQuery.save,
  delete: SecureQuery.delete,
  rawQuery: SecureQuery.rawQuery,
  count: SecureQuery.count,
  getRepository: SecureQuery.getRepository,
  createContext: createQueryContext
};
