import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { GameRoom } from './GameRoom';
import { MatchmakingQueue, QueueEntry } from './MatchmakingQueue';
import { ReplayStorage } from './storage/ReplayStorage';
import { ReplayCompressor } from './ReplayCompressor';

export interface ClientConnection {
  id: string;
  ws: WebSocket;
  userId: string | null;
  currentRoomId: string | null;
  lastPing: number;
  isInQueue: boolean;
  elo: number;
  region: string;
}

export interface NetworkMessage {
  type: string;
  [key: string]: any;
}

export class NetworkManager {
  private wss: WebSocket.Server;
  private clients: Map<string, ClientConnection> = new Map();
  private rooms: Map<string, GameRoom> = new Map();
  private matchmakingQueue: MatchmakingQueue;
  private replayStorage: ReplayStorage;

  constructor(port: number) {
    this.wss = new WebSocket.Server({ port });
    
    // Initialize matchmaking with callback
    this.matchmakingQueue = new MatchmakingQueue(
      (p1, p2) => this.createMatch(p1, p2)
    );
    
    // Initialize replay storage
    this.replayStorage = new ReplayStorage({
      compress: true
    });
    
    this.replayStorage.initialize().catch(err => {
      console.error('Failed to initialize replay storage:', err);
    });
    
    this.setupServer();
    console.log(`WebSocket server listening on port ${port}`);
  }

  private setupServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = uuidv4();
      const client: ClientConnection = {
        id: clientId,
        ws,
        userId: null,
        currentRoomId: null,
        lastPing: Date.now(),
        isInQueue: false,
        elo: 1000, // Default Elo
        region: 'global' // Default region
      };

      this.clients.set(clientId, client);
      console.log(`Client connected: ${clientId}`);

      ws.on('message', (data: Buffer) => {
        this.handleMessage(client, data.toString());
      });

      ws.on('close', () => {
        this.handleDisconnect(client);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });

      // Send connection confirmation
      this.send(client, {
        type: 'CONNECTED',
        clientId
      });
    });

    // Ping clients every 30 seconds
    setInterval(() => this.pingClients(), 30000);
  }

  private handleMessage(client: ClientConnection, data: string) {
    try {
      const message: NetworkMessage = JSON.parse(data);

      switch (message.type) {
        case 'AUTHENTICATE':
          this.handleAuth(client, message.token);
          break;

        case 'JOIN_QUEUE':
          this.handleJoinQueue(client);
          break;

        case 'LEAVE_QUEUE':
          this.handleLeaveQueue(client);
          break;

        case 'INPUT':
          this.handleInput(client, message);
          break;

        case 'PONG':
          client.lastPing = Date.now();
          break;
        
        case 'GET_STATS':
          this.handleGetStats(client);
          break;

        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  private handleAuth(client: ClientConnection, token: string) {
    // TODO: Validate token with auth service
    // For now, accept any token
    client.userId = token || client.id;
    
    this.send(client, {
      type: 'AUTHENTICATED',
      userId: client.userId
    });
  }

  private handleJoinQueue(client: ClientConnection) {
    if (client.isInQueue) {
      return; // Already in queue
    }

    if (client.currentRoomId) {
      this.send(client, {
        type: 'ERROR',
        message: 'Already in a match'
      });
      return;
    }

    client.isInQueue = true;
    
    // Add to matchmaking queue
    this.matchmakingQueue.addPlayer(
      client.id,
      client.userId || client.id,
      client.elo,
      client.region
    );

    this.send(client, {
      type: 'QUEUE_JOINED',
      queueSize: this.matchmakingQueue.getQueueSize(),
      position: this.matchmakingQueue.getPlayerPosition(client.id),
      elo: client.elo
    });
  }

  private handleLeaveQueue(client: ClientConnection) {
    if (!client.isInQueue) {
      return;
    }

    client.isInQueue = false;
    this.matchmakingQueue.removePlayer(client.id);

    this.send(client, {
      type: 'QUEUE_LEFT'
    });
  }

  private handleGetStats(client: ClientConnection) {
    const stats = this.matchmakingQueue.getStats();
    this.send(client, {
      type: 'STATS',
      matchmaking: stats,
      connectedPlayers: this.clients.size,
      activeMatches: this.rooms.size
    });
  }

  private createMatch(p1: QueueEntry, p2: QueueEntry) {
    const client1 = this.clients.get(p1.clientId);
    const client2 = this.clients.get(p2.clientId);

    if (!client1 || !client2) {
      console.error('Client not found for match');
      return;
    }

    // Create game room
    const room = new GameRoom(client1, client2);
    this.rooms.set(room.id, room);

    client1.currentRoomId = room.id;
    client2.currentRoomId = room.id;
    client1.isInQueue = false;
    client2.isInQueue = false;

    console.log(`Match created: ${p1.userId} (${p1.elo}) vs ${p2.userId} (${p2.elo}) in room ${room.id}`);

    // Notify players
    this.send(client1, {
      type: 'MATCH_FOUND',
      roomId: room.id,
      opponentId: client2.id,
      opponentElo: client2.elo,
      playerSide: 0 // player1
    });

    this.send(client2, {
      type: 'MATCH_FOUND',
      roomId: room.id,
      opponentId: client1.id,
      opponentElo: client1.elo,
      playerSide: 1 // player2
    });
  }

  private handleInput(client: ClientConnection, message: NetworkMessage) {
    if (!client.currentRoomId) {
      return; // Not in a match
    }

    const room = this.rooms.get(client.currentRoomId);
    if (!room) {
      return;
    }

    room.handleInput(client.id, message.frame, message.actions);
  }

  private handleDisconnect(client: ClientConnection) {
    console.log(`Client disconnected: ${client.id}`);

    // Remove from queue
    if (client.isInQueue) {
      this.matchmakingQueue.removePlayer(client.id);
    }

    // Remove from room if in one
    if (client.currentRoomId) {
      const room = this.rooms.get(client.currentRoomId);
      if (room) {
        room.handlePlayerDisconnect(client.id);
        
        // Save replay
        const winner = client.id === room.player1.id ? 2 : 1;
        const replay = room.recorder.stopRecording(winner);
        if (replay) {
          this.replayStorage.saveReplay(replay).catch(err => {
            console.error('Failed to save replay:', err);
          });
        }
        
        // Notify other player
        const otherPlayer = room.getOtherPlayer(client.id);
        if (otherPlayer) {
          this.send(otherPlayer, {
            type: 'OPPONENT_DISCONNECTED'
          });
        }
        this.rooms.delete(client.currentRoomId);
      }
    }

    this.clients.delete(client.id);
  }

  private pingClients() {
    for (const client of this.clients.values()) {
      if (Date.now() - client.lastPing > 60000) {
        // Disconnect if no pong in 60 seconds
        console.log(`Client ${client.id} timeout - disconnecting`);
        client.ws.close();
      } else {
        this.send(client, { type: 'PING' });
      }
    }
  }

  send(client: ClientConnection, message: NetworkMessage) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  broadcast(roomId: string, message: NetworkMessage, excludeClientId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const player of [room.player1, room.player2]) {
      if (player.id !== excludeClientId) {
        this.send(player, message);
      }
    }
  }
}
