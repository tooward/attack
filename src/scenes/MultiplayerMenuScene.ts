import Phaser from 'phaser';
import { NetworkClient, ConnectionState } from '../network/NetworkClient';

export class MultiplayerMenuScene extends Phaser.Scene {
  private networkClient: NetworkClient | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private matchmakingText: Phaser.GameObjects.Text | null = null;
  private connectButton: Phaser.GameObjects.Text | null = null;
  private findMatchButton: Phaser.GameObjects.Text | null = null;
  private cancelButton: Phaser.GameObjects.Text | null = null;
  private backButton: Phaser.GameObjects.Text | null = null;
  
  private queueStartTime: number = 0;
  private queueTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'MultiplayerMenuScene' });
  }

  create() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    // Title
    this.add.text(centerX, 80, 'Online Multiplayer', {
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Status text
    this.statusText = this.add.text(centerX, 150, 'Not Connected', {
      fontSize: '24px',
      color: '#888888'
    }).setOrigin(0.5);

    // Matchmaking status (hidden by default)
    this.matchmakingText = this.add.text(centerX, 220, '', {
      fontSize: '20px',
      color: '#ffaa00'
    }).setOrigin(0.5);
    this.matchmakingText.setVisible(false);

    // Connect button
    this.connectButton = this.createButton(
      centerX, centerY - 50,
      'Connect to Server',
      () => this.handleConnect()
    );

    // Find match button (hidden initially)
    this.findMatchButton = this.createButton(
      centerX, centerY,
      'Find Match',
      () => this.handleFindMatch()
    );
    this.findMatchButton.setVisible(false);

    // Cancel button (hidden initially)
    this.cancelButton = this.createButton(
      centerX, centerY + 50,
      'Cancel',
      () => this.handleCancel()
    );
    this.cancelButton.setVisible(false);

    // Back button
    this.backButton = this.createButton(
      centerX, centerY + 150,
      'Back to Menu',
      () => this.handleBack()
    );

    // Get server URL from config
    const serverUrl = this.getServerUrl();
    
    // Create network client
    this.networkClient = new NetworkClient({ serverUrl });
    
    // Register handlers
    this.setupNetworkHandlers();
  }

  private createButton(x: number, y: number, text: string, callback: () => void): Phaser.GameObjects.Text {
    const button = this.add.text(x, y, text, {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#4a90e2',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive();

    button.on('pointerover', () => {
      button.setStyle({ backgroundColor: '#5aa3ff' });
    });

    button.on('pointerout', () => {
      button.setStyle({ backgroundColor: '#4a90e2' });
    });

    button.on('pointerdown', callback);

    return button;
  }

  private setupNetworkHandlers() {
    if (!this.networkClient) return;

    // Match found
    this.networkClient.on('MATCH_FOUND', (message) => {
      console.log('Match found:', message);
      
      // Stop queue timer
      if (this.queueTimer) {
        this.queueTimer.remove();
        this.queueTimer = null;
      }

      // Start the match
      this.startOnlineMatch(message);
    });

    // Disconnected
    this.networkClient.on('DISCONNECTED', (message) => {
      console.log('Disconnected from server:', message);
      this.updateUI();
      
      if (message.wasInMatch) {
        // Show disconnect message and return to menu
        this.showDisconnectDialog();
      }
    });

    // Queue updates (if server sends them)
    this.networkClient.on('QUEUE_UPDATE', (message) => {
      this.matchmakingText?.setText(
        `Searching for opponent...\nQueue position: ${message.position}`
      );
    });
  }

  private async handleConnect() {
    if (!this.networkClient) return;

    this.statusText?.setText('Connecting...');
    this.connectButton?.setVisible(false);

    try {
      await this.networkClient.connect();
      
      // Generate or load user ID
      const userId = await this.getUserId();
      await this.networkClient.authenticate(userId);

      this.statusText?.setText('Connected');
      this.statusText?.setColor('#00ff00');
      
      this.updateUI();
      
    } catch (error) {
      console.error('Connection failed:', error);
      this.statusText?.setText('Connection Failed');
      this.statusText?.setColor('#ff0000');
      this.connectButton?.setVisible(true);
    }
  }

  private async handleFindMatch() {
    if (!this.networkClient) return;

    try {
      this.queueStartTime = Date.now();
      await this.networkClient.joinQueue();
      
      this.updateUI();
      
      // Start queue timer
      this.queueTimer = this.time.addEvent({
        delay: 1000,
        callback: this.updateQueueTime,
        callbackScope: this,
        loop: true
      });
      
    } catch (error) {
      console.error('Failed to join queue:', error);
      this.statusText?.setText(`Error: ${error.message}`);
    }
  }

  private handleCancel() {
    if (!this.networkClient) return;

    this.networkClient.leaveQueue();
    
    if (this.queueTimer) {
      this.queueTimer.remove();
      this.queueTimer = null;
    }
    
    this.updateUI();
  }

  private handleBack() {
    // Disconnect if connected
    if (this.networkClient) {
      this.networkClient.disconnect();
    }
    
    // Return to main menu
    this.scene.start('MainMenuScene');
  }

  private updateUI() {
    if (!this.networkClient) return;

    const state = this.networkClient.getState();
    
    switch (state) {
      case ConnectionState.DISCONNECTED:
      case ConnectionState.CONNECTING:
        this.connectButton?.setVisible(true);
        this.findMatchButton?.setVisible(false);
        this.cancelButton?.setVisible(false);
        this.matchmakingText?.setVisible(false);
        break;

      case ConnectionState.CONNECTED:
      case ConnectionState.AUTHENTICATED:
        this.connectButton?.setVisible(false);
        this.findMatchButton?.setVisible(true);
        this.cancelButton?.setVisible(false);
        this.matchmakingText?.setVisible(false);
        break;

      case ConnectionState.IN_QUEUE:
        this.connectButton?.setVisible(false);
        this.findMatchButton?.setVisible(false);
        this.cancelButton?.setVisible(true);
        this.matchmakingText?.setVisible(true);
        this.matchmakingText?.setText('Searching for opponent...');
        break;

      case ConnectionState.IN_MATCH:
        // Hide all UI
        this.connectButton?.setVisible(false);
        this.findMatchButton?.setVisible(false);
        this.cancelButton?.setVisible(false);
        this.matchmakingText?.setVisible(false);
        break;
    }
  }

  private updateQueueTime() {
    const elapsed = Math.floor((Date.now() - this.queueStartTime) / 1000);
    this.matchmakingText?.setText(
      `Searching for opponent...\nTime: ${elapsed}s`
    );
  }

  private startOnlineMatch(matchInfo: any) {
    // Store match info in registry for PhaserGameScene
    this.registry.set('onlineMatch', {
      networkClient: this.networkClient,
      roomId: matchInfo.roomId,
      opponentId: matchInfo.opponentId,
      opponentElo: matchInfo.opponentElo,
      playerSide: matchInfo.playerSide
    });

    // Start game scene
    this.scene.start('PhaserGameScene');
  }

  private showDisconnectDialog() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    // Darken background
    const overlay = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000, 0.7
    ).setOrigin(0);

    // Dialog box
    const dialogBg = this.add.rectangle(centerX, centerY, 500, 300, 0x222222)
      .setStrokeStyle(2, 0xffffff);

    const title = this.add.text(centerX, centerY - 80, 'Disconnected', {
      fontSize: '32px',
      color: '#ff0000'
    }).setOrigin(0.5);

    const message = this.add.text(
      centerX, centerY - 20,
      'Connection to opponent lost.\nReturning to menu...',
      {
        fontSize: '20px',
        color: '#ffffff',
        align: 'center'
      }
    ).setOrigin(0.5);

    const okButton = this.createButton(
      centerX, centerY + 80,
      'OK',
      () => {
        overlay.destroy();
        dialogBg.destroy();
        title.destroy();
        message.destroy();
        okButton.destroy();
        this.scene.start('MainMenuScene');
      }
    );
  }

  private async getUserId(): Promise<string> {
    // Try to load existing user ID from storage
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const result = await Preferences.get({ key: 'userId' });
      
      if (result.value) {
        return result.value;
      }
    } catch (error) {
      console.warn('Preferences not available, using localStorage');
      const stored = localStorage.getItem('userId');
      if (stored) {
        return stored;
      }
    }

    // Generate new user ID
    const userId = this.generateUserId();
    
    // Save it
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: 'userId', value: userId });
    } catch (error) {
      localStorage.setItem('userId', userId);
    }

    return userId;
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getServerUrl(): string {
    // In production, use environment variable or config
    // For now, use localhost for development
    if (window.location.hostname === 'localhost') {
      return 'ws://localhost:8081';
    }
    
    // Production server
    return 'wss://your-server.com';
  }

  shutdown() {
    // Clean up timer
    if (this.queueTimer) {
      this.queueTimer.remove();
      this.queueTimer = null;
    }
  }
}
