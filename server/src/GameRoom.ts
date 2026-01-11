import { ClientConnection } from './NetworkManager';
import { ReplayRecorder } from './ReplayRecorder';

export interface InputFrame {
  frame: number;
  actions: number[];
}

export class GameRoom {
  id: string;
  player1: ClientConnection;
  player2: ClientConnection;
  currentFrame: number = 0;
  inputBuffer: Map<string, InputFrame[]> = new Map();
  isActive: boolean = true;
  recorder: ReplayRecorder = new ReplayRecorder();
  
  // Frame tracking for debug
  private lastFrameP0: number = -1;
  private lastFrameP1: number = -1;
  private lastLogTime: number = Date.now();

  constructor(p1: ClientConnection, p2: ClientConnection) {
    this.id = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.player1 = p1;
    this.player2 = p2;

    this.inputBuffer.set(p1.id, []);
    this.inputBuffer.set(p2.id, []);

    // Start recording the match
    this.recorder.startRecording(this.id, p1, p2);

    console.log(`GameRoom created: ${this.id}`);
  }

  handleInput(clientId: string, frame: number, actions: number[]) {
    const isP0 = clientId === this.player1.id;
    const now = Date.now();
    
    // Update frame tracking
    if (isP0) {
      this.lastFrameP0 = frame;
    } else {
      this.lastFrameP1 = frame;
    }
    
    // Log summary every 2 seconds
    if (now - this.lastLogTime > 2000) {
      console.log(`[Room] P0: frame ${this.lastFrameP0}, P1: frame ${this.lastFrameP1}`);
      this.lastLogTime = now;
    }
    
    if (!this.isActive) return;

    const buffer = this.inputBuffer.get(clientId);
    if (!buffer) return;

    buffer.push({ frame, actions });

    // Get current inputs for both players for this frame
    const p1Inputs = clientId === this.player1.id ? actions : this.getLastInputs(this.player1.id);
    const p2Inputs = clientId === this.player2.id ? actions : this.getLastInputs(this.player2.id);

    // Record frame for replay
    this.recorder.recordFrame(frame, p1Inputs, p2Inputs);

    // Relay input to opponent
    const opponent = this.getOtherPlayer(clientId);
    if (opponent) {
      // Send opponent's input
      const playerSide = clientId === this.player1.id ? 0 : 1;
      if (opponent.ws.readyState === 1) { // WebSocket.OPEN
        opponent.ws.send(JSON.stringify({
          type: 'OPPONENT_INPUT',
          frame,
          actions,
          playerSide
        }));
      }
    }
  }

  getLastInputs(clientId: string): number[] {
    const buffer = this.inputBuffer.get(clientId);
    if (!buffer || buffer.length === 0) {
      return [0, 0, 0, 0, 0]; // Empty input
    }
    return buffer[buffer.length - 1].actions;
  }

  handlePlayerDisconnect(clientId: string) {
    console.log(`Player \${clientId} disconnected from room \${this.id}`);
    this.isActive = false;
  }

  getOtherPlayer(clientId: string): ClientConnection | null {
    if (clientId === this.player1.id) {
      return this.player2;
    } else if (clientId === this.player2.id) {
      return this.player1;
    }
    return null;
  }

  getPlayerInputs(clientId: string): InputFrame[] {
    return this.inputBuffer.get(clientId) || [];
  }
}
