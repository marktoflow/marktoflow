import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_EVENTS } from '@shared/constants';
import type {
  WorkflowUpdatedEvent,
  ExecutionStepEvent,
  ExecutionCompletedEvent,
} from '@shared/types';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onWorkflowUpdated?: (event: WorkflowUpdatedEvent) => void;
  onExecutionStep?: (event: ExecutionStepEvent) => void;
  onExecutionCompleted?: (event: ExecutionCompletedEvent) => void;
  onAIProcessing?: (processing: boolean) => void;
  onAIResponse?: (response: any) => void;
}

interface UseWebSocketReturn {
  connected: boolean;
  socket: Socket | null;
  subscribeToWorkflow: (path: string) => void;
  unsubscribeFromWorkflow: (path: string) => void;
  subscribeToExecution: (runId: string) => void;
  unsubscribeFromExecution: (runId: string) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    autoConnect = true,
    onWorkflowUpdated,
    onExecutionStep,
    onExecutionCompleted,
    onAIProcessing,
    onAIResponse,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // Store callbacks in refs to avoid reconnection on callback changes
  const callbacksRef = useRef({
    onWorkflowUpdated,
    onExecutionStep,
    onExecutionCompleted,
    onAIProcessing,
    onAIResponse,
  });

  useEffect(() => {
    callbacksRef.current = {
      onWorkflowUpdated,
      onExecutionStep,
      onExecutionCompleted,
      onAIProcessing,
      onAIResponse,
    };
  }, [
    onWorkflowUpdated,
    onExecutionStep,
    onExecutionCompleted,
    onAIProcessing,
    onAIResponse,
  ]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io({
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });

    // Event handlers
    socket.on(WS_EVENTS.WORKFLOW_UPDATED, (event: WorkflowUpdatedEvent) => {
      callbacksRef.current.onWorkflowUpdated?.(event);
    });

    socket.on(WS_EVENTS.EXECUTION_STEP, (event: ExecutionStepEvent) => {
      callbacksRef.current.onExecutionStep?.(event);
    });

    socket.on(WS_EVENTS.EXECUTION_COMPLETED, (event: ExecutionCompletedEvent) => {
      callbacksRef.current.onExecutionCompleted?.(event);
    });

    socket.on(WS_EVENTS.AI_PROCESSING, ({ processing }: { processing: boolean }) => {
      callbacksRef.current.onAIProcessing?.(processing);
    });

    socket.on(WS_EVENTS.AI_RESPONSE, (response: any) => {
      callbacksRef.current.onAIResponse?.(response);
    });

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  const subscribeToWorkflow = useCallback((path: string) => {
    socketRef.current?.emit(WS_EVENTS.WORKFLOW_SUBSCRIBE, path);
  }, []);

  const unsubscribeFromWorkflow = useCallback((path: string) => {
    socketRef.current?.emit(WS_EVENTS.WORKFLOW_UNSUBSCRIBE, path);
  }, []);

  const subscribeToExecution = useCallback((runId: string) => {
    socketRef.current?.emit(WS_EVENTS.EXECUTION_SUBSCRIBE, runId);
  }, []);

  const unsubscribeFromExecution = useCallback((runId: string) => {
    socketRef.current?.emit(WS_EVENTS.EXECUTION_UNSUBSCRIBE, runId);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connected,
    socket: socketRef.current,
    subscribeToWorkflow,
    unsubscribeFromWorkflow,
    subscribeToExecution,
    unsubscribeFromExecution,
    connect,
    disconnect,
  };
}
