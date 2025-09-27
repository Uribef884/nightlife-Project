import { useCallback, useEffect, useRef, useState } from 'react';

interface SSEEvent {
  type: 'connected' | 'status_update' | 'error' | 'ping';
  status?: string;
  transactionId?: string;
  timestamp?: string;
  error?: string;
  [key: string]: unknown;
}

interface UseSSEOptions {
  onStatusUpdate?: (status: string, data: SSEEvent) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export const useSSE = (transactionId: string | null, options: UseSSEOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const { onStatusUpdate, onError, onConnect, onDisconnect } = options;

  const connect = useCallback(() => {
    if (!transactionId || eventSourceRef.current) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${apiUrl}/api/sse/transaction/${transactionId}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      onConnect?.();
    };

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        setLastEvent(data);

        switch (data.type) {
          case 'connected':
            break;
          case 'status_update':
            if (data.status && onStatusUpdate) {
              onStatusUpdate(data.status, data);
            }
            break;
          case 'error':
            setError(data.error || 'Unknown error');
            if (onError) {
              onError(data.error || 'Unknown error');
            }
            break;
          case 'ping':
            // Keep connection alive
            break;
          default:
            break;
        }
      } catch {
        setError('Failed to parse server message');
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      
      if (eventSource.readyState === EventSource.CLOSED) {
        onDisconnect?.();
        
        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Exponential backoff, max 30s
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setError('Connection lost. Please refresh the page.');
        }
      }
    };
  }, [transactionId, onConnect, onStatusUpdate, onError, onDisconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      onDisconnect?.();
    }
  }, [onDisconnect]);

  useEffect(() => {
    if (transactionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [transactionId, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    lastEvent,
    error,
    connect,
    disconnect
  };
};
