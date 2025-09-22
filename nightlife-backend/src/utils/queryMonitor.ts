// src/utils/queryMonitor.ts

// Simple logger for query monitoring
const queryLogger = {
  warn: (message: string, meta?: any) => {
    console.warn(`[QUERY-MONITOR] ${message}`, meta || '');
  },
  error: (message: string, meta?: any) => {
    console.error(`[QUERY-MONITOR] ${message}`, meta || '');
  },
  info: (message: string, meta?: any) => {
    console.info(`[QUERY-MONITOR] ${message}`, meta || '');
  }
};

interface QueryMetrics {
  queryType: string;
  executionTime: number;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  queryHash?: string;
}

class QueryMonitor {
  private static instance: QueryMonitor;
  private slowQueryThreshold: number = 10000; // 10 seconds (increased for high-volume operations)
  private suspiciousQueryThreshold: number = 5000; // 5 seconds (increased)
  private queryCounts: Map<string, number> = new Map();
  private queryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isProduction: boolean = process.env.NODE_ENV === 'production';
  // Monitoring is enabled by default in production, can be disabled with QUERY_MONITORING=false
  private monitoringEnabled: boolean = process.env.QUERY_MONITORING !== 'false';

  private constructor() {}

  public static getInstance(): QueryMonitor {
    if (!QueryMonitor.instance) {
      QueryMonitor.instance = new QueryMonitor();
    }
    return QueryMonitor.instance;
  }

  /**
   * Monitor a database query execution - optimized for high-volume operations
   */
  public async monitorQuery<T>(
    queryName: string,
    queryFunction: () => Promise<T>,
    context?: { userId?: string; sessionId?: string; queryHash?: string }
  ): Promise<T> {
    // Skip monitoring only if explicitly disabled
    if (!this.monitoringEnabled) {
      return await queryFunction();
    }

    const startTime = Date.now();
    const queryId = `${queryName}_${startTime}`;
    
    try {
      // Set up timeout for the query - increased for high-volume operations
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Query timeout: ${queryName} exceeded 30 seconds`));
        }, 30000); // 30 second timeout (increased)
        
        this.queryTimeouts.set(queryId, timeout);
      });

      // Execute the query with timeout
      const result = await Promise.race([
        queryFunction(),
        timeoutPromise
      ]);

      // Clear timeout if query completes successfully
      const timeout = this.queryTimeouts.get(queryId);
      if (timeout) {
        clearTimeout(timeout);
        this.queryTimeouts.delete(queryId);
      }

      const executionTime = Date.now() - startTime;
      
      // Only record metrics if monitoring is enabled
      if (this.monitoringEnabled) {
        this.recordQueryMetrics({
          queryType: queryName,
          executionTime,
          timestamp: new Date(),
          userId: context?.userId,
          sessionId: context?.sessionId,
          queryHash: context?.queryHash
        });
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Clear timeout on error
      const timeout = this.queryTimeouts.get(queryId);
      if (timeout) {
        clearTimeout(timeout);
        this.queryTimeouts.delete(queryId);
      }

      // Only log errors if monitoring is enabled
      if (this.monitoringEnabled) {
        queryLogger.error(`Query failed: ${queryName}`, {
          executionTime,
          error: error instanceof Error ? error.message : 'Unknown error',
          context
        });
      }

      throw error;
    }
  }

  /**
   * Record query metrics and detect suspicious patterns
   */
  private recordQueryMetrics(metrics: QueryMetrics): void {
    const { queryType, executionTime, userId, sessionId } = metrics;
    
    // Track query frequency
    const queryKey = `${queryType}_${userId || sessionId || 'anonymous'}`;
    const currentCount = this.queryCounts.get(queryKey) || 0;
    this.queryCounts.set(queryKey, currentCount + 1);

    // Check for slow queries
    if (executionTime > this.slowQueryThreshold) {
      queryLogger.warn(`Slow query detected: ${queryType}`, {
        executionTime: `${executionTime}ms`,
        threshold: `${this.slowQueryThreshold}ms`,
        userId,
        sessionId
      });
    }

    // Check for suspicious query patterns (potential blind SQL injection)
    if (executionTime > this.suspiciousQueryThreshold) {
      queryLogger.warn(`Suspicious query timing: ${queryType}`, {
        executionTime: `${executionTime}ms`,
        threshold: `${this.suspiciousQueryThreshold}ms`,
        userId,
        sessionId,
        warning: 'Potential blind SQL injection attempt detected'
      });
    }

    // Check for query frequency abuse
    if (currentCount > 50) { // More than 50 queries in a short time
      queryLogger.warn(`High query frequency detected`, {
        queryType,
        count: currentCount,
        userId,
        sessionId,
        warning: 'Potential automated attack or resource abuse'
      });
    }

    // Log all queries for monitoring
    queryLogger.info(`Query executed: ${queryType}`, {
      executionTime: `${executionTime}ms`,
      userId,
      sessionId
    });
  }

  /**
   * Reset query counts (call periodically)
   */
  public resetQueryCounts(): void {
    this.queryCounts.clear();
  }

  /**
   * Get current query statistics
   */
  public getQueryStats(): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    this.queryCounts.forEach((count, key) => {
      stats[key] = count;
    });
    return stats;
  }

  /**
   * Clean up timeouts
   */
  public cleanup(): void {
    this.queryTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.queryTimeouts.clear();
  }
}

// Export singleton instance
export const queryMonitor = QueryMonitor.getInstance();

// Export utility function for easy use
export async function monitorQuery<T>(
  queryName: string,
  queryFunction: () => Promise<T>,
  context?: { userId?: string; sessionId?: string; queryHash?: string }
): Promise<T> {
  return queryMonitor.monitorQuery(queryName, queryFunction, context);
}
