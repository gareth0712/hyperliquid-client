/**
 * Multi-Connection WebSocket client for tracking 10+ users simultaneously
 * - Supports parallel WebSocket connections for better scalability
 * - Optimized data saving for multiple wallets
 *
 * cli 'src/wsClient.ts'
 */

import WebSocket from 'ws';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WebSocketMessage, WebData2Message, LowestValueEvent, AllMids, SubscriptionType, ClientMode, DataSaveMode, ConnectionInfo, ConnectionStats, SpotToken } from './types';

// --- Config for Multi-Connection ---
// Try to add more than 10 addresses to test the rate limit
const USER_ADDRESSES = ['0x0000000000000000000000000000000000000000'];
const RECONNECT_DELAY_MS = 5000; // 5 seconds
const SAVE_CONTINUOUS_DATA = true;
const SAVE_LOWEST_VALUE_EVENTS = true;

// Multi-Connection Configuration
const MAX_USERS_PER_CONNECTION = 3; // Maximum users per WebSocket connection
const CONNECTION_STAGGER_DELAY = 1000; // Delay between connection attempts (ms)
const MAX_RECONNECT_ATTEMPTS = 5;
const HEALTH_CHECK_INTERVAL = 30000; // Health check every 30 seconds

// Subscription Configuration
// webData2 - Getting the latest account value (Perp) and spot balances
// allMids - Getting the latest prices for all tokens
const SUBSCRIPTION_TYPES: SubscriptionType[] = ['webData2', 'allMids'];
const ALLMIDS_DEX = undefined;

// Mode Configuration
const CLIENT_MODE: ClientMode = 'continuous';

// Data Saving Configuration
const DATA_SAVE_MODE: DataSaveMode = 'historical' as DataSaveMode;
// -----------------------------------

// --- State Management ---
let lowestValueToday: number = Infinity;
let messageCount = 0;
let continuousDataLog: any[] = [];
let lowestValueEvents: LowestValueEvent[] = [];
let currentDate: string = new Date().toISOString().slice(0, 10).replace(/-/g, '');

// --- Price Data Management ---
let latestPrices: Map<string, string> = new Map();

let spotTokenMapping: Map<string, SpotToken> = new Map();
let tokenToAllMidsMapping: Map<string, string> = new Map();

const initializeTokenMapping = (): void => {
  const spotMetaPath = path.join(__dirname, '..', 'dataFromSubscription', currentDate, 'spotMeta.json');

  if (fs.existsSync(spotMetaPath)) {
    try {
      const spotMetaData = JSON.parse(fs.readFileSync(spotMetaPath, 'utf8'));

      if (spotMetaData.universe) {
        // Extract token information from universe data
        spotMetaData.universe.forEach((tokenInfo: any) => {
          if (tokenInfo.name) {
            const token: SpotToken = {
              name: tokenInfo.name,
              index: tokenInfo.index,
              tokenId: tokenInfo.tokenId || '',
              fullName: tokenInfo.fullName,
            };
            spotTokenMapping.set(tokenInfo.name, token);
          }
        });
      }

      // Setup specific token mappings for allMids
      tokenToAllMidsMapping.set('USOL', 'SOL'); // USOL maps to SOL in allMids
      tokenToAllMidsMapping.set('USDC', 'USDC'); // USDC stays as USDC but always $1

      console.log(`📋 Loaded ${spotTokenMapping.size} spot tokens from spotMeta`);
      console.log(
        `🔗 Token mappings: ${Array.from(tokenToAllMidsMapping.entries())
          .map(([k, v]) => `${k}->${v}`)
          .join(', ')}`
      );
    } catch (error) {
      console.error(`⚠️ Error loading spotMeta: ${error}`);
    }
  } else {
    console.log(`⚠️ spotMeta.json not found at ${spotMetaPath}`);
  }
};

const log = (message: string) => {
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  console.log(`[${now}] ${message}`);
};

const getCurrentDateString = (): string => {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
};

const ensureDataDirectory = (): string => {
  const dataDir = path.join(__dirname, '..', 'dataFromSubscription', currentDate);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
};

const saveContinuousData = (data: any) => {
  if (!SAVE_CONTINUOUS_DATA) return;

  const timestamp = new Date().toISOString();
  const dataWithMetadata = {
    timestamp,
    messageCount,
    data,
  };

  continuousDataLog.push(dataWithMetadata);

  // Save to file every 10 messages
  if (messageCount % 10 === 0) {
    const dataDir = ensureDataDirectory();
    const continuousDataFile = path.join(dataDir, `${currentDate}.json`);

    try {
      fs.writeFileSync(continuousDataFile, JSON.stringify(continuousDataLog, null, 2));
      log(`💾 Saved continuous data to ${currentDate}.json (${continuousDataLog.length} messages)`);
    } catch (error) {
      log(`❌ Error saving continuous data: ${error}`);
    }
  }
};

const saveLowestValueEvent = (accountValue: number, rawData: any) => {
  if (!SAVE_LOWEST_VALUE_EVENTS) return;

  const event: LowestValueEvent = {
    timestamp: new Date().toISOString(),
    accountValue,
    messageCount,
    rawData,
  };

  lowestValueEvents.push(event);

  const dataDir = ensureDataDirectory();
  const lowestValueFile = path.join(dataDir, `${currentDate}-lowestAccountValue.json`);

  try {
    fs.writeFileSync(lowestValueFile, JSON.stringify(lowestValueEvents, null, 2));
    log(`🏆 Saved lowest value event to ${currentDate}-lowestAccountValue.json (${lowestValueEvents.length} events)`);
  } catch (error) {
    log(`❌ Error saving lowest value event: ${error}`);
  }
};

const loadExistingData = () => {
  const dataDir = path.join(__dirname, '..', 'dataFromSubscription', currentDate);

  // Load existing continuous data
  const continuousDataFile = path.join(dataDir, `${currentDate}.json`);
  if (fs.existsSync(continuousDataFile)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(continuousDataFile, 'utf8'));
      continuousDataLog = existingData;
      messageCount = existingData.length;
      log(`📂 Loaded existing continuous data: ${existingData.length} messages`);
    } catch (error) {
      log(`⚠️ Error loading existing continuous data: ${error}`);
    }
  }

  // Load existing lowest value events
  const lowestValueFile = path.join(dataDir, `${currentDate}-lowestAccountValue.json`);
  if (fs.existsSync(lowestValueFile)) {
    try {
      const existingEvents = JSON.parse(fs.readFileSync(lowestValueFile, 'utf8'));
      lowestValueEvents = existingEvents;

      // Find the lowest value from existing events
      if (existingEvents.length > 0) {
        const existingLowest = Math.min(...existingEvents.map((e: LowestValueEvent) => e.accountValue));
        lowestValueToday = existingLowest;
        log(`📂 Loaded existing lowest value: ${lowestValueToday.toFixed(4)} from ${existingEvents.length} events`);
      }
    } catch (error) {
      log(`⚠️ Error loading existing lowest value events: ${error}`);
    }
  }
};

const analyzeDataStructure = (data: any, path: string = 'root'): void => {
  if (typeof data === 'object' && data !== null) {
    Object.keys(data).forEach((key) => {
      const currentPath = path === 'root' ? key : `${path}.${key}`;
      const value = data[key];

      if (typeof value === 'object' && value !== null) {
        log(`🔍 Found object at ${currentPath}: ${typeof value}`);
        analyzeDataStructure(value, currentPath);
      } else {
        log(`🔍 Found ${typeof value} at ${currentPath}: ${value}`);
      }
    });
  }
};

// --- Price Data Functions ---
const updatePriceData = (allMidsData: AllMids): void => {
  if (allMidsData.mids) {
    Object.entries(allMidsData.mids).forEach(([coin, price]) => {
      latestPrices.set(coin, price);
    });

    console.log(`💰 Updated prices for ${Object.keys(allMidsData.mids).length} tokens`);

    // Log sample prices (first 5)
    const samplePrices = Object.entries(allMidsData.mids).slice(0, 5);
    samplePrices.forEach(([coin, price]) => {
      console.log(`   ${coin}: $${price}`);
    });

    if (Object.keys(allMidsData.mids).length > 5) {
      console.log(`   ... and ${Object.keys(allMidsData.mids).length - 5} more`);
    }
  }
};

const getTokenPrice = (coin: string): string | null => {
  return latestPrices.get(coin) || null;
};

const getSpotTokenPrice = (spotCoin: string): string | null => {
  // Special case for USDC - always $1
  if (spotCoin === 'USDC') {
    return '1.0';
  }

  // Get the mapped allMids key for this spot token
  const allMidsKey = tokenToAllMidsMapping.get(spotCoin);
  if (allMidsKey) {
    return getTokenPrice(allMidsKey);
  }

  // Try direct mapping if no specific mapping exists
  return getTokenPrice(spotCoin);
};

const savePriceData = (): void => {
  const dataDir = ensureDataDirectory();
  const priceDataFile = path.join(dataDir, `${currentDate}-prices.json`);

  const priceData = {
    timestamp: new Date().toISOString(),
    prices: Object.fromEntries(latestPrices),
    totalTokens: latestPrices.size,
  };

  try {
    fs.writeFileSync(priceDataFile, JSON.stringify(priceData, null, 2));
    console.log(`💾 Saved price data to ${currentDate}-prices.json (${latestPrices.size} tokens)`);
  } catch (error) {
    console.error(`❌ Error saving price data: ${error}`);
  }
};

class MultiConnectionHyperLiquidClient {
  private connections: Map<string, ConnectionInfo> = new Map();
  private userToConnectionMap: Map<string, string> = new Map();
  private dataDir: string;
  private today: string;
  private clientMode: ClientMode;
  private dataSaveMode: DataSaveMode;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionStats: ConnectionStats;

  // User-specific data storage
  private userDataFiles: Map<string, string> = new Map();
  private userLowestValueFiles: Map<string, string> = new Map();
  private userExistingData: Map<string, WebSocketMessage[]> = new Map();
  private userExistingLowestData: Map<string, any[]> = new Map();
  private userLowestAccountValues: Map<string, number | null> = new Map();
  private userHighestAccountValues: Map<string, number | null> = new Map();

  // Historical data storage
  private userHistoricalDataFiles: Map<string, string> = new Map();
  private userHistoricalLowestFiles: Map<string, string> = new Map();
  private userExistingHistoricalData: Map<string, any[]> = new Map();
  private userLowestTotalAccountValues: Map<string, number | null> = new Map();

  // AllMids throttling
  private lastAllMidsUpdate: number = 0;
  private allMidsUpdateInterval: number = 5000;

  // Performance tracking
  private totalMessagesReceived: number = 0;
  private connectionStartTime: number = Date.now();

  constructor(userAddresses: string[], clientMode: ClientMode = 'continuous', dataSaveMode: DataSaveMode = 'all') {
    this.clientMode = clientMode;
    this.dataSaveMode = dataSaveMode;
    this.dataDir = 'data/dataFromSubscription';
    this.today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Initialize connection stats
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      totalUsers: userAddresses.length,
      messagesReceived: 0,
      lastUpdate: new Date().toISOString(),
      connectionDetails: new Map(),
    };

    // Initialize token mapping
    initializeTokenMapping();

    // Initialize user data structures
    this.initializeUserData(userAddresses);

    // Setup connection groups
    this.setupConnectionGroups(userAddresses);

    // Ensure directory exists
    this.ensureDirectoryExists();

    // Load existing data
    this.loadExistingData();
  }

  private setupConnectionGroups(userAddresses: string[]): void {
    const connectionGroups: string[][] = [];

    // Group users into connections (max MAX_USERS_PER_CONNECTION per connection)
    for (let i = 0; i < userAddresses.length; i += MAX_USERS_PER_CONNECTION) {
      const group = userAddresses.slice(i, i + MAX_USERS_PER_CONNECTION);
      connectionGroups.push(group);
    }

    console.log(`👥 Creating ${connectionGroups.length} connections for ${userAddresses.length} users`);
    console.log(`📊 Users per connection: ${MAX_USERS_PER_CONNECTION} (max)`);

    // Create connection info for each group
    connectionGroups.forEach((userGroup, index) => {
      const connectionId = `conn-${index + 1}`;
      const connectionInfo: ConnectionInfo = {
        id: connectionId,
        ws: null,
        userAddresses: userGroup,
        isConnected: false,
        reconnectAttempts: 0,
        lastHeartbeat: Date.now(),
        subscriptionTypes: SUBSCRIPTION_TYPES,
      };

      this.connections.set(connectionId, connectionInfo);

      // Map each user to their connection
      userGroup.forEach((userAddress) => {
        this.userToConnectionMap.set(userAddress, connectionId);
      });

      // Initialize connection stats
      this.connectionStats.connectionDetails.set(connectionId, {
        users: userGroup,
        status: 'disconnected',
        messagesCount: 0,
      });

      console.log(`🔗 Connection ${connectionId}: ${userGroup.join(', ')}`);
    });

    this.connectionStats.totalConnections = connectionGroups.length;
  }

  private initializeUserData(userAddresses: string[]): void {
    userAddresses.forEach((userAddress) => {
      const normalizedAddress = userAddress.toLowerCase();

      if (this.dataSaveMode === 'historical') {
        this.userHistoricalDataFiles.set(userAddress, `data/accountValueHistorical/${this.today}/${normalizedAddress}.json`);
        this.userHistoricalLowestFiles.set(userAddress, `data/accountValueHistorical/${this.today}/${normalizedAddress}-lowest.json`);
        this.userExistingHistoricalData.set(userAddress, []);
        this.userLowestTotalAccountValues.set(userAddress, null);
      } else {
        this.userDataFiles.set(userAddress, `${this.dataDir}/${this.today}/${normalizedAddress}.json`);
        this.userLowestValueFiles.set(userAddress, `${this.dataDir}/${this.today}/${normalizedAddress}-lowestAccountValue.json`);
      }

      this.userExistingData.set(userAddress, []);
      this.userExistingLowestData.set(userAddress, []);
      this.userLowestAccountValues.set(userAddress, null);
      this.userHighestAccountValues.set(userAddress, null);
    });
  }

  private ensureDirectoryExists(): void {
    if (this.dataSaveMode === 'historical') {
      const dir = `data/accountValueHistorical/${this.today}`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created historical directory: ${dir}`);
      }
    } else {
      const dir = `${this.dataDir}/${this.today}`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    }
  }

  private loadExistingData(): void {
    Array.from(this.userExistingData.keys()).forEach((userAddress) => {
      try {
        if (this.dataSaveMode === 'historical') {
          const historicalDataFile = this.userHistoricalDataFiles.get(userAddress)!;
          const historicalLowestFile = this.userHistoricalLowestFiles.get(userAddress)!;

          if (fs.existsSync(historicalDataFile)) {
            const data = fs.readFileSync(historicalDataFile, 'utf8');
            const existingData = JSON.parse(data);
            this.userExistingHistoricalData.set(userAddress, existingData);
            console.log(`📊 Loaded ${existingData.length} existing historical messages for ${userAddress}`);
          }

          if (fs.existsSync(historicalLowestFile)) {
            const data = fs.readFileSync(historicalLowestFile, 'utf8');
            const existingLowestData = JSON.parse(data);

            if (existingLowestData && typeof existingLowestData === 'object' && existingLowestData.totalAccountValue) {
              const value = parseFloat(existingLowestData.totalAccountValue);
              this.userLowestTotalAccountValues.set(userAddress, value);
              console.log(`📊 ${userAddress} - Historical Lowest Total Account Value: ${value}`);
            }
          }
        } else {
          const dataFile = this.userDataFiles.get(userAddress)!;
          const lowestValueFile = this.userLowestValueFiles.get(userAddress)!;

          if (fs.existsSync(dataFile)) {
            const data = fs.readFileSync(dataFile, 'utf8');
            const existingData = JSON.parse(data);
            this.userExistingData.set(userAddress, existingData);
            console.log(`📊 Loaded ${existingData.length} existing messages for ${userAddress}`);
          }

          if (fs.existsSync(lowestValueFile)) {
            const data = fs.readFileSync(lowestValueFile, 'utf8');
            const existingLowestData = JSON.parse(data);
            this.userExistingLowestData.set(userAddress, existingLowestData);

            existingLowestData.forEach((event: any) => {
              const value = parseFloat(event.accountValue);
              const currentLowest = this.userLowestAccountValues.get(userAddress);
              const currentHighest = this.userHighestAccountValues.get(userAddress);

              if (currentLowest === null || currentLowest === undefined || value < currentLowest) {
                this.userLowestAccountValues.set(userAddress, value);
              }
              if (currentHighest === null || currentHighest === undefined || value > currentHighest) {
                this.userHighestAccountValues.set(userAddress, value);
              }
            });

            const lowest = this.userLowestAccountValues.get(userAddress);
            const highest = this.userHighestAccountValues.get(userAddress);
            console.log(`📊 ${userAddress} - Lowest: ${lowest}, Highest: ${highest}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error loading existing data for ${userAddress}:`, error);
      }
    });
  }

  public async connectAll(): Promise<void> {
    console.log(`🚀 Starting Multi-Connection HyperLiquid WebSocket Client`);
    console.log(`🔗 Creating ${this.connections.size} parallel connections`);
    console.log(`👥 Tracking ${this.connectionStats.totalUsers} users total`);
    console.log(`📡 Subscription types: ${SUBSCRIPTION_TYPES.join(', ')}`);

    // Start health check monitoring
    this.startHealthCheck();

    // Connect all connections with staggered timing
    const connectionPromises: Promise<void>[] = [];
    let delay = 0;

    for (const [connectionId, connectionInfo] of this.connections) {
      const promise = new Promise<void>((resolve) => {
        setTimeout(() => {
          this.connectSingle(connectionId);
          resolve();
        }, delay);
      });

      connectionPromises.push(promise);
      delay += CONNECTION_STAGGER_DELAY;
    }

    // Wait for all connections to be initiated
    await Promise.all(connectionPromises);

    console.log(`✅ All ${this.connections.size} connections initiated`);
  }

  private connectSingle(connectionId: string): void {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) return;

    console.log(`🔌 Connecting ${connectionId} for users: ${connectionInfo.userAddresses.join(', ')}`);

    connectionInfo.ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    connectionInfo.ws.on('open', () => {
      console.log(`✅ ${connectionId} connected successfully`);
      connectionInfo.isConnected = true;
      connectionInfo.reconnectAttempts = 0;
      connectionInfo.lastHeartbeat = Date.now();

      // Update connection stats
      this.updateConnectionStats();
      const details = this.connectionStats.connectionDetails.get(connectionId)!;
      details.status = 'connected';

      // Setup subscriptions for this connection
      this.setupSubscriptions(connectionId);
    });

    connectionInfo.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(connectionId, data);
    });

    connectionInfo.ws.on('close', () => {
      console.log(`🔌 ${connectionId} connection closed`);
      connectionInfo.isConnected = false;

      // Update connection stats
      this.updateConnectionStats();
      const details = this.connectionStats.connectionDetails.get(connectionId)!;
      details.status = 'disconnected';

      if (this.clientMode === 'continuous') {
        this.handleReconnect(connectionId);
      }
    });

    connectionInfo.ws.on('error', (error) => {
      console.error(`❌ ${connectionId} WebSocket error:`, error);
      connectionInfo.isConnected = false;
    });
  }

  private setupSubscriptions(connectionId: string): void {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo || !connectionInfo.ws) return;

    const subscriptionMessages: any[] = [];

    // Setup webData2 subscriptions for all users in this connection
    if (connectionInfo.subscriptionTypes.includes('webData2')) {
      connectionInfo.userAddresses.forEach((userAddress) => {
        subscriptionMessages.push({
          method: 'subscribe',
          subscription: {
            type: 'webData2',
            user: userAddress,
          },
        });
      });
    }

    // Setup allMids subscription (only one per connection)
    if (connectionInfo.subscriptionTypes.includes('allMids')) {
      const allMidsSubscription: any = {
        method: 'subscribe',
        subscription: {
          type: 'allMids',
        },
      };

      if (ALLMIDS_DEX) {
        allMidsSubscription.subscription.dex = ALLMIDS_DEX;
      }

      subscriptionMessages.push(allMidsSubscription);
    }

    // Send all subscriptions
    subscriptionMessages.forEach((subscription) => {
      if (connectionInfo.ws) {
        connectionInfo.ws.send(JSON.stringify(subscription));
      }
    });

    console.log(`📡 ${connectionId} sent ${subscriptionMessages.length} subscriptions`);
  }

  private handleMessage(connectionId: string, data: WebSocket.Data): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      // Update connection heartbeat
      const connectionInfo = this.connections.get(connectionId);
      if (connectionInfo) {
        connectionInfo.lastHeartbeat = Date.now();

        // Update message count for this connection
        const details = this.connectionStats.connectionDetails.get(connectionId)!;
        details.messagesCount++;
      }

      // Update global stats
      this.totalMessagesReceived++;
      this.connectionStats.messagesReceived = this.totalMessagesReceived;
      this.connectionStats.lastUpdate = new Date().toISOString();

      // Process message based on type
      if (message.channel === 'webData2') {
        this.saveData(message);
        this.processWebData2Message(message as WebData2Message, connectionId);
      } else if (message.channel === 'allMids') {
        this.processAllMidsMessage(message.data as AllMids);
      }

      // Log progress every 100 messages
      if (this.totalMessagesReceived % 100 === 0) {
        this.logConnectionStatus();
      }
    } catch (error) {
      console.error(`❌ Error parsing message from ${connectionId}:`, error);
    }
  }

  private handleReconnect(connectionId: string): void {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) return;

    if (connectionInfo.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      connectionInfo.reconnectAttempts++;

      // Update connection status
      const details = this.connectionStats.connectionDetails.get(connectionId)!;
      details.status = 'reconnecting';

      const delay = RECONNECT_DELAY_MS * Math.pow(2, connectionInfo.reconnectAttempts - 1); // Exponential backoff

      console.log(`🔄 ${connectionId} attempting reconnect ${connectionInfo.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

      setTimeout(() => {
        this.connectSingle(connectionId);
      }, delay);
    } else {
      console.log(`❌ ${connectionId} max reconnection attempts reached`);
      const details = this.connectionStats.connectionDetails.get(connectionId)!;
      details.status = 'disconnected';
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, HEALTH_CHECK_INTERVAL);
  }

  private performHealthCheck(): void {
    const now = Date.now();
    let unhealthyConnections = 0;

    for (const [connectionId, connectionInfo] of this.connections) {
      const timeSinceLastHeartbeat = now - connectionInfo.lastHeartbeat;

      if (connectionInfo.isConnected && timeSinceLastHeartbeat > HEALTH_CHECK_INTERVAL * 2) {
        console.log(`⚠️ ${connectionId} appears unhealthy (no heartbeat for ${timeSinceLastHeartbeat}ms)`);
        unhealthyConnections++;

        // Attempt to reconnect unhealthy connections
        if (this.clientMode === 'continuous') {
          connectionInfo.isConnected = false;
          this.handleReconnect(connectionId);
        }
      }
    }

    if (unhealthyConnections === 0) {
      console.log(`💚 Health check passed - all ${this.connections.size} connections healthy`);
    }

    this.updateConnectionStats();
  }

  private updateConnectionStats(): void {
    this.connectionStats.activeConnections = Array.from(this.connections.values()).filter((conn) => conn.isConnected).length;
    this.connectionStats.lastUpdate = new Date().toISOString();
  }

  private logConnectionStatus(): void {
    console.log(`\n📊 === CONNECTION STATUS ===`);
    console.log(`🔗 Active Connections: ${this.connectionStats.activeConnections}/${this.connectionStats.totalConnections}`);
    console.log(`👥 Total Users: ${this.connectionStats.totalUsers}`);
    console.log(`📨 Total Messages: ${this.connectionStats.messagesReceived}`);
    console.log(`⏱️ Uptime: ${((Date.now() - this.connectionStartTime) / 1000 / 60).toFixed(1)}m`);

    for (const [connectionId, details] of this.connectionStats.connectionDetails) {
      const statusIcon = details.status === 'connected' ? '✅' : details.status === 'reconnecting' ? '🔄' : '❌';
      console.log(`   ${statusIcon} ${connectionId}: ${details.users.length} users, ${details.messagesCount} msgs, ${details.status}`);
    }
    console.log(`========================\n`);
  }

  private formatServerTimeToLocal(serverTime: number): string {
    // Convert milliseconds to Date object
    const date = new Date(serverTime);

    // Get GMT+8 time (Asia/Shanghai timezone)
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };

    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(date);

    // Extract parts and format as YYYYMMDDTHHMMSSZ+8
    const year = parts.find((part) => part.type === 'year')?.value || '';
    const month = parts.find((part) => part.type === 'month')?.value || '';
    const day = parts.find((part) => part.type === 'day')?.value || '';
    const hour = parts.find((part) => part.type === 'hour')?.value || '';
    const minute = parts.find((part) => part.type === 'minute')?.value || '';
    const second = parts.find((part) => part.type === 'second')?.value || '';

    return `${year}${month}${day}T${hour}:${minute}:${second}Z+8`;
  }

  private saveData(message: WebSocketMessage): void {
    const fs = require('fs');

    try {
      // Extract user address from WebData2 messages
      if (message.channel === 'webData2') {
        const webData2Message = message as WebData2Message;
        const userAddress = webData2Message.data.user;

        if (!userAddress) {
          console.log(`❌ No user address found in webData2 message`);
          return;
        }

        // Handle historical mode differently
        if (this.dataSaveMode === 'historical') {
          this.saveHistoricalData(webData2Message);
          return;
        }

        // Find the original case-sensitive user address from our config
        const originalUserAddress = Array.from(this.userExistingData.keys()).find(
          (addr) => addr.toLowerCase() === userAddress!.toLowerCase()
        );

        if (originalUserAddress) {
          let messageToSave = message;

          // Filter data based on save mode
          if (this.dataSaveMode === 'spotAndPerps') {
            const localTime = this.formatServerTimeToLocal(webData2Message.data.serverTime);

            messageToSave = {
              channel: message.channel,
              data: {
                clearinghouseState: webData2Message.data.clearinghouseState,
                spotState: webData2Message.data.spotState,
                serverTime: webData2Message.data.serverTime,
                localTime: localTime,
                user: webData2Message.data.user,
              },
            };

            // Log when filtering is applied (only for first few messages)
            const existingUserData = this.userExistingData.get(originalUserAddress);
            if (!existingUserData || existingUserData.length <= 3) {
              console.log('💾 Applied spotAndPerps filtering - saved only essential fields');
            }
          } else {
            // For 'all' mode, add localTime to the existing data
            const localTime = this.formatServerTimeToLocal(webData2Message.data.serverTime);

            messageToSave = {
              ...message,
              data: {
                ...webData2Message.data,
                localTime: localTime,
              },
            };
          }

          // Save data using the original case-sensitive address
          if (this.userDataFiles.has(originalUserAddress)) {
            // Append to main data file
            const existingData = this.userExistingData.get(originalUserAddress) || [];
            existingData.push(messageToSave);
            this.userExistingData.set(originalUserAddress, existingData);
            const filePath = this.userDataFiles.get(originalUserAddress);
            if (!filePath) {
              console.log(`❌ Could not find data file path for: ${originalUserAddress}`);
              return;
            }
            fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
            console.log(`💾 Saved message ${existingData.length} for ${originalUserAddress}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error saving data:', error);
    }
  }

  private saveLowestValueEvent(event: any): void {
    const fs = require('fs');

    try {
      const userAddress = event.user;
      if (userAddress && this.userLowestValueFiles.has(userAddress)) {
        // Append to lowest value file
        const existingLowestData = this.userExistingLowestData.get(userAddress) || [];
        existingLowestData.push(event);
        this.userExistingLowestData.set(userAddress, existingLowestData);
        const lowestFilePath = this.userLowestValueFiles.get(userAddress);
        if (!lowestFilePath) {
          console.log(`❌ Could not find lowest value file path for: ${userAddress}`);
          return;
        }
        fs.writeFileSync(lowestFilePath, JSON.stringify(existingLowestData, null, 2));
        console.log(`💾 Saved lowest value event to ${lowestFilePath}`);
      }
    } catch (error) {
      console.error('❌ Error saving lowest value event:', error);
    }
  }

  private calculateTotalAccountValue(clearinghouseValue: string, spotBalances: any[]): number {
    let totalValue = parseFloat(clearinghouseValue);

    spotBalances.forEach((balance) => {
      if (balance.coin === 'USDC') {
        // For USDC, add the total amount
        totalValue += parseFloat(balance.total);
      } else {
        // For other tokens, add the entryNtl value
        totalValue += parseFloat(balance.entryNtl || '0');
      }
    });

    return totalValue;
  }

  private calculateTotalAccountValueWithCurrentPrices(
    clearinghouseValue: string,
    spotBalances: any[]
  ): { totalValue: number; pricesUsed: Record<string, string> } {
    let totalValue = parseFloat(clearinghouseValue);
    const pricesUsed: Record<string, string> = {};

    spotBalances.forEach((balance) => {
      const tokenAmount = parseFloat(balance.total || '0');

      if (tokenAmount <= 0) {
        return; // Skip tokens with zero balance
      }

      if (balance.coin === 'USDC') {
        // For USDC, add the total amount (always $1 per token)
        totalValue += tokenAmount;
        pricesUsed[balance.coin] = '1.00';
        console.log(`💰 ${balance.coin}: ${tokenAmount} × $1.00 = $${tokenAmount.toFixed(6)}`);
      } else {
        // For other tokens, use the enhanced spot token price lookup
        const currentPrice = getSpotTokenPrice(balance.coin);

        if (currentPrice) {
          const currentValue = tokenAmount * parseFloat(currentPrice);
          totalValue += currentValue;
          pricesUsed[balance.coin] = currentPrice;
          const mappedToken = tokenToAllMidsMapping.get(balance.coin);
          const priceSource = mappedToken ? `${mappedToken} price` : 'direct price';
          console.log(`💰 ${balance.coin}: ${tokenAmount} × $${currentPrice} = $${currentValue.toFixed(6)} (${priceSource})`);
        } else {
          // Fallback to entryNtl if no current price available
          const entryValue = parseFloat(balance.entryNtl || '0');
          totalValue += entryValue;
          pricesUsed[balance.coin] = `entryNtl:${balance.entryNtl || '0'}`;
          console.log(`📊 ${balance.coin}: Using entryNtl $${entryValue} (no current price available)`);
        }
      }
    });

    return { totalValue, pricesUsed };
  }

  private createHistoricalDataEntry(webData2Message: WebData2Message): any {
    const data = webData2Message.data;
    const clearinghouseValue = data.clearinghouseState?.marginSummary?.accountValue || '0';
    const spotBalances = data.spotState?.balances || [];

    // Use current prices if allMids is subscribed and we have price data
    const useCurrentPrices = SUBSCRIPTION_TYPES.includes('allMids') && latestPrices.size > 0;
    let totalAccountValue: number;
    let pricesUsed: Record<string, string> = {};

    if (useCurrentPrices) {
      const result = this.calculateTotalAccountValueWithCurrentPrices(clearinghouseValue, spotBalances);
      totalAccountValue = result.totalValue;
      pricesUsed = result.pricesUsed;
      console.log(`💰 Using current prices for total account value calculation: $${totalAccountValue}`);
    } else {
      totalAccountValue = this.calculateTotalAccountValue(clearinghouseValue, spotBalances);
      console.log(`📊 Using entryNtl for total account value calculation: $${totalAccountValue}`);

      // For fallback mode, record what prices we would have used (entryNtl values)
      spotBalances.forEach((balance) => {
        if (parseFloat(balance.total || '0') > 0) {
          if (balance.coin === 'USDC') {
            pricesUsed[balance.coin] = '1.00';
          } else {
            pricesUsed[balance.coin] = `entryNtl:${balance.entryNtl || '0'}`;
          }
        }
      });
    }

    return {
      totalAccountValue: totalAccountValue.toString(),
      clearinghouseState: clearinghouseValue,
      spotBalance: spotBalances,
      pricesUsed: pricesUsed,
      serverTime: data.serverTime,
      localTime: this.formatServerTimeToLocal(data.serverTime),
      priceSource: useCurrentPrices ? 'currentPrices' : 'entryNtl',
    };
  }

  private saveHistoricalData(message: WebData2Message): void {
    const fs = require('fs');
    const userAddress = message.data.user;

    // Find the original case-sensitive user address
    const originalUserAddress = Array.from(this.userExistingData.keys()).find((addr) => addr.toLowerCase() === userAddress.toLowerCase());

    if (!originalUserAddress) {
      console.log(`❌ Could not find original address for: ${userAddress}`);
      return;
    }

    try {
      const historicalEntry = this.createHistoricalDataEntry(message);
      const totalAccountValue = parseFloat(historicalEntry.totalAccountValue);

      // Save to main historical data file
      const existingData = this.userExistingHistoricalData.get(originalUserAddress) || [];
      existingData.push(historicalEntry);
      this.userExistingHistoricalData.set(originalUserAddress, existingData);

      const filePath = this.userHistoricalDataFiles.get(originalUserAddress);
      if (!filePath) {
        console.log(`❌ Could not find historical file path for: ${originalUserAddress}`);
        return;
      }
      fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
      console.log(
        `💾 Saved historical message ${existingData.length} for ${originalUserAddress} (Total Account Value: ${totalAccountValue})`
      );

      // Check if this is a new lowest total account value
      const currentLowest = this.userLowestTotalAccountValues.get(originalUserAddress);
      if (currentLowest === null || currentLowest === undefined || totalAccountValue < currentLowest) {
        this.userLowestTotalAccountValues.set(originalUserAddress, totalAccountValue);
        console.log(`📉 NEW LOWEST TOTAL ACCOUNT VALUE for ${originalUserAddress}: ${totalAccountValue}`);

        // Save to lowest historical data file (replace the entire content with single object)
        const lowestFilePath = this.userHistoricalLowestFiles.get(originalUserAddress);
        if (!lowestFilePath) {
          console.log(`❌ Could not find historical lowest file path for: ${originalUserAddress}`);
          return;
        }
        fs.writeFileSync(lowestFilePath, JSON.stringify(historicalEntry, null, 2));
        console.log(`💾 Saved historical lowest value event to ${lowestFilePath}`);
      }
    } catch (error) {
      console.error('❌ Error saving historical data:', error);
    }
  }

  private processWebData2Message(message: WebData2Message, connectionId: string): void {
    const data = message.data;
    const userAddress = data.user;

    if (data.clearinghouseState && data.clearinghouseState.marginSummary) {
      const accountValue = parseFloat(data.clearinghouseState.marginSummary.accountValue);
      const timestamp = new Date().toISOString();

      // Update lowest and highest values
      const currentLowest = this.userLowestAccountValues.get(userAddress);
      const currentHighest = this.userHighestAccountValues.get(userAddress);

      if (currentLowest === null || currentLowest === undefined || accountValue < currentLowest) {
        this.userLowestAccountValues.set(userAddress, accountValue);
        console.log(`📉 NEW LOWEST ACCOUNT VALUE for ${userAddress} (from ${connectionId}): ${accountValue} at ${timestamp}`);

        // Save lowest value event
        const event = {
          timestamp,
          accountValue: accountValue.toString(),
          marginSummary: data.clearinghouseState.marginSummary,
          crossMarginSummary: data.clearinghouseState.crossMarginSummary,
          withdrawable: data.clearinghouseState.withdrawable,
          serverTime: data.serverTime,
          user: userAddress,
        };

        this.saveLowestValueEvent(event);
      }

      if (currentHighest === null || currentHighest === undefined || accountValue > currentHighest) {
        this.userHighestAccountValues.set(userAddress, accountValue);
        console.log(`📈 NEW HIGHEST ACCOUNT VALUE for ${userAddress} (from ${connectionId}): ${accountValue} at ${timestamp}`);
      }

      // Log current status every 10 messages
      const existingUserData = this.userExistingData.get(userAddress);
      if (existingUserData && existingUserData.length % 10 === 0) {
        const lowestValue = this.userLowestAccountValues.get(userAddress) ?? 'N/A';
        const highestValue = this.userHighestAccountValues.get(userAddress) ?? 'N/A';
        console.log(
          `📊 Status ${userAddress} - Current: ${accountValue}, Lowest: ${lowestValue}, Highest: ${highestValue}, Messages: ${existingUserData.length}`
        );
      }
    }
  }

  private processAllMidsMessage(allMidsData: AllMids): void {
    const currentTime = Date.now();

    // Only update prices every 5 seconds to match webData2 update frequency
    if (currentTime - this.lastAllMidsUpdate >= this.allMidsUpdateInterval) {
      updatePriceData(allMidsData);
      this.lastAllMidsUpdate = currentTime;
      console.log(`💰 Updated price data (${Object.keys(allMidsData.mids).length} tokens) - throttled to ~5s intervals`);
    }
    // Silently ignore high-frequency allMids updates
  }

  public disconnect(): void {
    console.log('🛑 Disconnecting all connections...');

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Disconnect all WebSocket connections
    for (const [connectionId, connectionInfo] of this.connections) {
      if (connectionInfo.ws) {
        connectionInfo.ws.close();
        connectionInfo.ws = null;
        connectionInfo.isConnected = false;
        console.log(`🔌 Disconnected ${connectionId}`);
      }
    }

    this.updateConnectionStats();
  }

  public getDetailedStatus(): ConnectionStats & {
    userStats: Map<
      string,
      {
        connectionId: string;
        lowestValue: number | null;
        highestValue: number | null;
        messageCount: number;
      }
    >;
  } {
    const userStats = new Map();

    for (const [userAddress] of this.userExistingData) {
      const connectionId = this.userToConnectionMap.get(userAddress) || 'unknown';
      const existingData = this.userExistingData.get(userAddress) || [];

      userStats.set(userAddress, {
        connectionId,
        lowestValue: this.userLowestAccountValues.get(userAddress),
        highestValue: this.userHighestAccountValues.get(userAddress),
        messageCount: existingData.length,
      });
    }

    return {
      ...this.connectionStats,
      userStats,
    };
  }
}

const main = async () => {
  console.log('🚀 Starting Enhanced Multi-Connection HyperLiquid WebSocket Client');

  const client = new MultiConnectionHyperLiquidClient(USER_ADDRESSES, CLIENT_MODE, DATA_SAVE_MODE);

  // Connect all WebSocket connections
  await client.connectAll();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    client.disconnect();

    const status = client.getDetailedStatus();
    console.log(
      '📊 Final Status:',
      JSON.stringify(
        {
          totalConnections: status.totalConnections,
          activeConnections: status.activeConnections,
          totalUsers: status.totalUsers,
          totalMessages: status.messagesReceived,
          userCount: status.userStats.size,
        },
        null,
        2
      )
    );

    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    client.disconnect();
    process.exit(0);
  });
};

main()
  .then(() => {
    console.log('Multi-connection client started successfully');
  })
  .catch((error) => {
    console.error('Error starting multi-connection client:', error);
  });
