import { NetworkMessage } from '../../server/src/NetworkManager';

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  AUTHENTICATED = 'AUTHENTICATED',
  IN_QUEUE = 'IN_QUEUE',
  IN_MATCH = 'IN_MATCH'
}

export interface NetworkConfig {
  serverUrl: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export class NetworkClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private messageHandlers: Map<string, (message: any) => void> = new Map();
  private reconnectAttempts: number = 0;
  private reconnectTimer: number | null = null;
  
  // Client info
  private clientId: string | null = null;
  private userId: string | null = null;
  private roomId: string | null = null;
  private playerSide: 0 | 1 | null = null;
  
  // Config
  private config: Required<NetworkConfig>;
  
  // Ping tracking
  private lastPingTime: number = 0;
  private ping: number = 0;
  
  constructor(config: NetworkConfig) {
    this.config = {
      serverUrl: config.serverUrl,
      reconnectDelay: config.reconnectDelay || 2000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5
    };
  }

  /**
   * Connect to the server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state !== ConnectionState.DISCONNECTED) {
        reject(new Error('Already connected or connecting'));
        return;
      }

      this.state = ConnectionState.CONNECTING;
      
      try {
        this.ws = new WebSocket(this.config.serverUrl);
        
        this.ws.onopen = () => {
          console.log('Connected to server');
          this.state = ConnectionState.CONNECTED;
          this.reconnectAttempts = 0;
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log('Disconnected from server');
          this.handleDisconnect();
        };
        
      } catch (error) {
        this.state = ConnectionState.DISCONNECTED;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.state = ConnectionState.DISCONNECTED;
    this.clientId = null;
    this.roomId = null;
    this.playerSide = null;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Authenticate with the server
   */
  authenticate(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state !== ConnectionState.CONNECTED) {
        reject(new Error('Not connected'));
        return;
      }

      this.on('AUTHENTICATED', (message) => {
        this.userId = message.userId;
        this.state = ConnectionState.AUTHENTICATED;
        console.log(`Authenticated as ${this.userId}`);
        resolve();
      });

      this.send({
        type: 'AUTHENTICATE',
        token
      });
    });
  }

  /**
   * Join matchmaking queue
   */
  joinQueue(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state !== ConnectionState.AUTHENTICATED) {
        reject(new Error('Not authenticated'));
        return;
      }

      this.on('QUEUE_JOINED', (message) => {
        // Ignore if we're already in a match (race condition - message arrived late)
        if (this.state === ConnectionState.IN_MATCH) {
          console.log('Ignoring QUEUE_JOINED - already in match');
          return;
        }
        
        this.state = ConnectionState.IN_QUEUE;
        console.log(`Joined queue: position ${message.position}, Elo ${message.elo}`);
        resolve();
      });

      this.on('ERROR', (message) => {
        reject(new Error(message.message));
      });

      this.send({
        type: 'JOIN_QUEUE'
      });
    });
  }

  /**
   * Leave matchmaking queue
   */
  leaveQueue() {
    if (this.state !== ConnectionState.IN_QUEUE) {
      return;
    }

    this.send({
      type: 'LEAVE_QUEUE'
    });

    this.state = ConnectionState.AUTHENTICATED;
  }

  /**
   * Send input to server
   */
  sendInput(frame: number, actions: number[]) {
    if (this.state !== ConnectionState.IN_MATCH) {
      console.warn(`[NetworkClient] Cannot send input - state is ${this.state}, expected IN_MATCH`);
      return;
    }

    this.send({
      type: 'INPUT',
      frame,
      actions
    });
  }

  /**
   * Register a message handler
   */
  on(messageType: string, handler: (message: any) => void) {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Unregister a message handler
   */
  off(messageType: string) {
    this.messageHandlers.delete(messageType);
  }

  /**
   * Send a message to the server
   */
  private send(message: NetworkMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: not connected');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string) {
    try {
      const message: NetworkMessage = JSON.parse(data);
      
      // Handle built-in messages
      switch (message.type) {
        case 'CONNECTED':
          this.clientId = message.clientId;
          console.log(`[NetworkClient] Connected - Client ID: ${this.clientId}`);
          break;

        case 'MATCH_FOUND':
          console.log(`[NetworkClient] MATCH_FOUND - state before: ${this.state}`);
          this.roomId = message.roomId;
          this.playerSide = message.playerSide;
          this.state = ConnectionState.IN_MATCH;
          console.log(`[NetworkClient] State set to IN_MATCH - Room: ${this.roomId}, Side: ${this.playerSide}`);
          break;

        case 'PING':
          this.lastPingTime = Date.now();
          this.send({ type: 'PONG' });
          break;

        case 'OPPONENT_DISCONNECTED':
          console.log('[NetworkClient] Opponent disconnected');
          this.state = ConnectionState.AUTHENTICATED;
          break;
      }

      // Call registered handler
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        console.log(`[NetworkClient] Calling handler for ${message.type}, state: ${this.state}`);
        handler(message);
        console.log(`[NetworkClient] Handler done for ${message.type}, state: ${this.state}`);
      }
      
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect() {
    const wasInMatch = this.state === ConnectionState.IN_MATCH;
    const wasInQueue = this.state === ConnectionState.IN_QUEUE;
    
    this.state = ConnectionState.DISCONNECTED;
    this.ws = null;
    
    // Notify handlers
    const handler = this.messageHandlers.get('DISCONNECTED');
    if (handler) {
      handler({ wasInMatch, wasInQueue });
    }

    // Auto-reconnect
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting in ${this.config.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
      
      this.reconnectTimer = window.setTimeout(() => {
        this.connect()
          .then(() => {
            // Re-authenticate if we were authenticated before
            if (this.userId) {
              return this.authenticate(this.userId);
            }
          })
          .catch(err => {
            console.error('Reconnection failed:', err);
          });
      }, this.config.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  // Getters
  getState(): ConnectionState { return this.state; }
  getClientId(): string | null { return this.clientId; }
  getUserId(): string | null { return this.userId; }
  getRoomId(): string | null { return this.roomId; }
  getPlayerSide(): 0 | 1 | null { return this.playerSide; }
  getPing(): number { return this.ping; }
  
  isConnected(): boolean { 
    return this.state !== ConnectionState.DISCONNECTED && 
           this.state !== ConnectionState.CONNECTING; 
  }
  
  isInMatch(): boolean { 
    return this.state === ConnectionState.IN_MATCH; 
  }
}
