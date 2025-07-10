# hyperliquid-client

This is a client for the Hyperliquid network that provides both node running capabilities and WebSocket data collection tools.

## WebSocket Client (wsClient.ts)

The `wsClient.ts` is a multi-connection WebSocket client for tracking multiple Hyperliquid users simultaneously. It supports parallel WebSocket connections for better scalability and optimized data saving.

### Features

- **Multi-User Tracking**: Monitor 10+ users simultaneously with automatic connection management
- **Real-time Data Collection**: Track account values, balances, and price data
- **Automatic Reconnection**: Continuous monitoring with health checks and reconnection logic
- **Flexible Data Storage**: Multiple storage modes for different use cases
- **Price Integration**: Real-time price data for accurate portfolio valuation

### Quick Start

1. **Configure User Addresses**: Edit the `USER_ADDRESSES` array in `wsClient.ts`:
```typescript
const USER_ADDRESSES = [
  '0x1234567890123456789012345678901234567890',
  '0x0987654321098765432109876543210987654321'
];
```

2. **Run the Client**:
```bash
# Using ts-node directly
npx ts-node src/wsClient.ts

# Or using the provided script
./scripts/ts-cli.sh src/wsClient.ts
```

### Configuration Options

#### ClientMode

Controls the client's operational behavior:

- **`'continuous'`** (Default): runs continuously until the user stops it
- **`'oneOff'`**: Collects data for a specified duration or until minimum data requirements are met, then exits automatically

```typescript
const CLIENT_MODE: ClientMode = 'continuous';

// OneOff Mode Configuration (only applies when CLIENT_MODE = 'oneOff')
const ONEOFF_DURATION_MS = 60000; // Maximum runtime: 60 seconds
const ONEOFF_MIN_MESSAGES_PER_USER = 5; // Minimum messages per user before allowing exit
```

**OneOff Mode Behavior:**
- Runs for a maximum of `ONEOFF_DURATION_MS` milliseconds (default: 60 seconds)
- Exits early if all users receive at least `ONEOFF_MIN_MESSAGES_PER_USER` messages
- Automatically disconnects and exits the process when conditions are met
- Does not attempt reconnections on connection failures

#### DataSaveMode

Determines what data is saved and where:

##### `'historical'` Mode
- **Purpose**: Optimized for tracking account value changes over time
- **Data Saved**: Total account value calculations with current prices
- **Storage Location**: `data/accountValueHistorical/YYYYMMDD/`
- **Files Created**:
  - `{address}.json`: All historical data points
  - `{address}-lowest.json`: Lowest account value record
- **Use Case**: Portfolio performance tracking, lowest value alerts

##### `'all'` Mode  
- **Purpose**: Complete data capture for analysis
- **Data Saved**: Full WebSocket messages with local timestamps
- **Storage Location**: `data/dataFromSubscription/YYYYMMDD/`
- **Files Created**:
  - `{address}.json`: All raw WebSocket data
  - `{address}-lowestAccountValue.json`: Lowest value events
- **Use Case**: Comprehensive data analysis, debugging

##### `'spotAndPerps'` Mode
- **Purpose**: Essential data only for efficiency
- **Data Saved**: Clearinghouse state, spot balances, timestamps
- **Storage Location**: `data/dataFromSubscription/YYYYMMDD/`
- **Files Created**: Same as 'all' mode but with filtered content
- **Use Case**: Lightweight monitoring, reduced storage requirements

```typescript
const DATA_SAVE_MODE: DataSaveMode = 'historical';
```

#### SubscriptionType

Defines what data streams to subscribe to:

##### `'webData2'`
- **Data**: Account values, margin summaries, spot/perp balances
- **Frequency**: ~5 second updates
- **Per User**: Yes, each user gets their own subscription
- **Essential For**: Portfolio tracking, balance monitoring

##### `'allMids'`
- **Data**: Current market prices for all tokens
- **Frequency**: High frequency (throttled to ~5s intervals)
- **Per Connection**: One subscription serves all users
- **Essential For**: Real-time portfolio valuation

```typescript
const SUBSCRIPTION_TYPES: SubscriptionType[] = ['webData2', 'allMids'];
```

### Connection Management

#### Multi-Connection Architecture

The client automatically distributes users across multiple WebSocket connections:

- **Max Users Per Connection**: 3 (configurable via `MAX_USERS_PER_CONNECTION`)
- **Connection Staggering**: 1 second delay between connections
- **Health Monitoring**: 30-second health checks with automatic recovery

#### Rate Limiting & Optimization

- **Reconnection Strategy**: Exponential backoff (max 5 attempts)
- **Price Update Throttling**: allMids updates limited to 5-second intervals
- **Connection Distribution**: Automatic load balancing across connections

### Data Storage Structure

#### Historical Mode (`data/accountValueHistorical/`)
```
data/accountValueHistorical/
└── 20250110/
    ├── 0x1234...7890.json           # All data points
    ├── 0x1234...7890-lowest.json    # Lowest value record
    ├── 0x0987...4321.json
    └── 0x0987...4321-lowest.json
```

**Historical Data Format**:
```json
[
  {
    "totalAccountValue": "1234.567890",
    "clearinghouseState": "1000.000000",
    "spotBalance": [...],
    "pricesUsed": {"SOL": "95.50", "USDC": "1.00"},
    "serverTime": 1673612345678,
    "localTime": "20250110T15:30:45Z+8",
    "priceSource": "currentPrices"
  }
]
```

#### Subscription Mode (`data/dataFromSubscription/`)
```
data/dataFromSubscription/
└── 20250110/
    ├── 0x1234...7890.json                    # Main data
    ├── 0x1234...7890-lowestAccountValue.json # Lowest events
    ├── 20250110-prices.json                  # Price snapshots
    └── spotMeta.json                         # Token metadata
```

**WebData2 Message Format**:
```json
{
  "channel": "webData2",
  "data": {
    "clearinghouseState": {...},
    "spotState": {...},
    "serverTime": 1673612345678,
    "localTime": "20250110T15:30:45Z+8",
    "user": "0x1234567890123456789012345678901234567890"
  }
}
```

### Advanced Configuration

#### Performance Tuning
```typescript
// Connection settings
const MAX_USERS_PER_CONNECTION = 3;        // Users per WebSocket
const CONNECTION_STAGGER_DELAY = 1000;     // Connection delay (ms)
const HEALTH_CHECK_INTERVAL = 30000;       // Health check frequency

// Data management
const SAVE_CONTINUOUS_DATA = true;         // Enable data saving
const SAVE_LOWEST_VALUE_EVENTS = true;     // Track lowest values
```

#### OneOff Mode Configuration
```typescript
// OneOff mode timing and exit conditions
const ONEOFF_DURATION_MS = 60000;          // Maximum runtime (ms)
const ONEOFF_MIN_MESSAGES_PER_USER = 5;    // Minimum messages per user
```

#### Price Integration
```typescript
// Enable price-based calculations
const SUBSCRIPTION_TYPES = ['webData2', 'allMids'];

// Token mapping for accurate pricing
const tokenToAllMidsMapping = new Map([
  ['USOL', 'SOL'],    // Maps spot USOL to SOL price
  ['USDC', 'USDC']    // USDC always valued at $1.00
]);
```

### Monitoring & Logging

The client provides real-time status updates:

```
📊 === CONNECTION STATUS ===
🔗 Active Connections: 3/3
👥 Total Users: 8
📨 Total Messages: 1,234
⏱️ Uptime: 45.2m
   ✅ conn-1: 3 users, 456 msgs, connected
   ✅ conn-2: 3 users, 389 msgs, connected
   ✅ conn-3: 2 users, 389 msgs, connected
========================
```

### Use Cases

#### Portfolio Tracking
```typescript
// Configure for historical account value tracking
const CLIENT_MODE = 'continuous';
const DATA_SAVE_MODE = 'historical';
const SUBSCRIPTION_TYPES = ['webData2', 'allMids'];
```

#### Data Analysis
```typescript
// Configure for comprehensive data collection
const CLIENT_MODE = 'continuous'; 
const DATA_SAVE_MODE = 'all';
const SUBSCRIPTION_TYPES = ['webData2', 'allMids'];
```

#### Lightweight Monitoring
```typescript
// Configure for essential data only
const CLIENT_MODE = 'continuous';
const DATA_SAVE_MODE = 'spotAndPerps';
const SUBSCRIPTION_TYPES = ['webData2'];
```

#### Quick Data Collection (OneOff)
```typescript
// Configure for quick data collection and automatic exit
const CLIENT_MODE = 'oneOff';
const DATA_SAVE_MODE = 'historical';
const SUBSCRIPTION_TYPES = ['webData2', 'allMids'];
const ONEOFF_DURATION_MS = 30000;      // Run for 30 seconds max
const ONEOFF_MIN_MESSAGES_PER_USER = 3; // Exit after 3 messages per user
```

### Troubleshooting

#### Connection Issues
- Check that addresses in `USER_ADDRESSES` are valid Ethereum addresses
- Ensure internet connectivity and WebSocket access
- Monitor console for reconnection attempts

#### Data Storage Issues
- Verify write permissions for `data/` directory
- Check available disk space
- Monitor file creation in appropriate subdirectories

#### Performance Issues
- Reduce `MAX_USERS_PER_CONNECTION` for better stability
- Increase `CONNECTION_STAGGER_DELAY` to avoid rate limiting
- Disable unnecessary subscription types

## Running a node

### Machine Spec

Recommended minimum hardware: 4 CPU cores, 32 GB RAM, 200 GB disk.

Currently only Ubuntu 24.04 is supported.

Ports 4001 and 4002 are used for gossip and must be open to the public. Otherwise, the node IP address will be deprioritized by peers in the p2p network.

For lowest latency, run the node in Tokyo, Japan.

### Set up

Refer to the [Hyperliquid Running non validator guide](https://github.com/hyperliquid-dex/node?tab=readme-ov-file#running-non-validator) for detailed instructions.

### Commands for running a node

The following command is supposed to run a non-validator node for Mainnet and make the server accessible only on the local machine (localhost) on port 8081. Since i haven't setup the ubuntu vm/container, i'm not sure if this command will work.

```bash
# This command does everything:
# 1. Runs a non-validator node for Mainnet.
# 2. Starts the Info Server (REST and WebSocket).
# 3. Makes the server accessible only on the local machine (localhost) on port 8081.
# 4. Runs the entire process in the background.

./hl-node --chain Mainnet run-node --info-server-host="127.0.0.1" --info-server-port=8081 &
```

