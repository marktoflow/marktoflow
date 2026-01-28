import type { Server as SocketIOServer, Socket } from 'socket.io';

interface ClientState {
  subscribedWorkflows: Set<string>;
  subscribedExecutions: Set<string>;
}

const clients = new Map<string, ClientState>();

export function setupWebSocket(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Initialize client state
    clients.set(socket.id, {
      subscribedWorkflows: new Set(),
      subscribedExecutions: new Set(),
    });

    // Handle workflow subscription
    socket.on('workflow:subscribe', (workflowPath: string) => {
      const state = clients.get(socket.id);
      if (state) {
        state.subscribedWorkflows.add(workflowPath);
        socket.join(`workflow:${workflowPath}`);
        console.log(`Client ${socket.id} subscribed to workflow: ${workflowPath}`);
      }
    });

    socket.on('workflow:unsubscribe', (workflowPath: string) => {
      const state = clients.get(socket.id);
      if (state) {
        state.subscribedWorkflows.delete(workflowPath);
        socket.leave(`workflow:${workflowPath}`);
      }
    });

    // Handle execution subscription
    socket.on('execution:subscribe', (runId: string) => {
      const state = clients.get(socket.id);
      if (state) {
        state.subscribedExecutions.add(runId);
        socket.join(`execution:${runId}`);
        console.log(`Client ${socket.id} subscribed to execution: ${runId}`);
      }
    });

    socket.on('execution:unsubscribe', (runId: string) => {
      const state = clients.get(socket.id);
      if (state) {
        state.subscribedExecutions.delete(runId);
        socket.leave(`execution:${runId}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      clients.delete(socket.id);
    });
  });

  // Helper functions to emit events
  return {
    // Emit to all clients subscribed to a workflow
    emitWorkflowUpdate(workflowPath: string, data: any) {
      io.to(`workflow:${workflowPath}`).emit('workflow:updated', {
        path: workflowPath,
        ...data,
      });
    },

    // Emit execution started
    emitExecutionStarted(runId: string, data: any) {
      io.to(`execution:${runId}`).emit('execution:started', {
        runId,
        ...data,
      });
      // Also broadcast to all clients for global execution history updates
      io.emit('execution:new', {
        runId,
        ...data,
      });
    },

    // Emit execution step update
    emitExecutionStep(runId: string, data: any) {
      io.to(`execution:${runId}`).emit('execution:step', {
        runId,
        ...data,
      });
    },

    // Emit execution completed
    emitExecutionCompleted(runId: string, data: any) {
      io.to(`execution:${runId}`).emit('execution:completed', {
        runId,
        ...data,
      });
    },

    // Emit AI processing status
    emitAIProcessing(socketId: string, processing: boolean) {
      io.to(socketId).emit('ai:processing', { processing });
    },

    // Emit AI response
    emitAIResponse(socketId: string, response: any) {
      io.to(socketId).emit('ai:response', response);
    },

    // Broadcast to all clients
    broadcast(event: string, data: any) {
      io.emit(event, data);
    },
  };
}
