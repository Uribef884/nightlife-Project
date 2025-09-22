import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { UnifiedPurchaseTransaction } from '../entities/UnifiedPurchaseTransaction';

// Store active SSE connections by transaction ID
const activeConnections = new Map<string, Response[]>();

export class SSEController {
  /**
   * SSE endpoint for transaction status updates
   * GET /api/sse/transaction/:transactionId
   */
  getTransactionStatusStream = async (req: Request, res: Response): Promise<void> => {
    const { transactionId } = req.params;

    console.log(`[SSE] New connection request for transaction: ${transactionId}`);

    if (!transactionId) {
      res.status(400).json({ error: 'Transaction ID is required' });
      return;
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to transaction status stream' })}\n\n`);

    // Add this connection to the active connections
    if (!activeConnections.has(transactionId)) {
      activeConnections.set(transactionId, []);
    }
    activeConnections.get(transactionId)!.push(res);
    
    console.log(`[SSE] Connection established for transaction ${transactionId}. Total connections: ${activeConnections.get(transactionId)!.length}`);

    // Send current status immediately
    try {
      const transactionRepo = AppDataSource.getRepository(UnifiedPurchaseTransaction);
      const transaction = await transactionRepo.findOne({
        where: { id: transactionId }
      });

      if (transaction) {
        res.write(`data: ${JSON.stringify({ 
          type: 'status_update', 
          status: transaction.paymentStatus,
          transactionId: transaction.id,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
    } catch (error) {
      console.error('Error fetching initial transaction status:', error);
    }

    // Handle client disconnect
    req.on('close', () => {
      console.log(`SSE connection closed for transaction: ${transactionId}`);
      const connections = activeConnections.get(transactionId);
      if (connections) {
        const index = connections.indexOf(res);
        if (index > -1) {
          connections.splice(index, 1);
        }
        if (connections.length === 0) {
          activeConnections.delete(transactionId);
        }
      }
    });

    // Keep connection alive with periodic ping
    const pingInterval = setInterval(() => {
      if (res.destroyed) {
        clearInterval(pingInterval);
        return;
      }
      res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000); // Ping every 30 seconds
  };

  /**
   * Broadcast status update to all connected clients for a transaction
   */
  static broadcastStatusUpdate(transactionId: string, status: string, additionalData?: any): void {
    console.log(`[SSE] Broadcasting status update for transaction ${transactionId}: ${status}`, additionalData);
    const connections = activeConnections.get(transactionId);
    
    if (connections) {
      console.log(`[SSE] Found ${connections.length} active connections for transaction ${transactionId}`);
      const message = {
        type: 'status_update',
        status,
        transactionId,
        timestamp: new Date().toISOString(),
        ...additionalData
      };

      console.log(`[SSE] Sending message:`, message);

      connections.forEach((res, index) => {
        try {
          if (!res.destroyed) {
            res.write(`data: ${JSON.stringify(message)}\n\n`);
            console.log(`[SSE] Message sent to connection ${index}`);
          } else {
            console.log(`[SSE] Removing destroyed connection ${index}`);
            // Remove destroyed connections
            connections.splice(index, 1);
          }
        } catch (error) {
          console.error('[SSE] Error sending SSE message:', error);
          connections.splice(index, 1);
        }
      });

      // Clean up empty connection arrays
      if (connections.length === 0) {
        console.log(`[SSE] No more connections for transaction ${transactionId}, cleaning up`);
        activeConnections.delete(transactionId);
      }
    } else {
      console.log(`[SSE] No active connections found for transaction ${transactionId}`);
    }
  }

  /**
   * Broadcast error to all connected clients for a transaction
   */
  static broadcastError(transactionId: string, error: string): void {
    const connections = activeConnections.get(transactionId);
    if (connections) {
      const message = {
        type: 'error',
        error,
        transactionId,
        timestamp: new Date().toISOString()
      };

      connections.forEach((res, index) => {
        try {
          if (!res.destroyed) {
            res.write(`data: ${JSON.stringify(message)}\n\n`);
          } else {
            connections.splice(index, 1);
          }
        } catch (err) {
          console.error('Error sending SSE error message:', err);
          connections.splice(index, 1);
        }
      });

      if (connections.length === 0) {
        activeConnections.delete(transactionId);
      }
    }
  }
}

export const sseController = new SSEController();
