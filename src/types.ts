export type SubscriptionType = 'webData2' | 'allMids';
export type ClientMode = 'continuous' | 'oneOff';
export type DataSaveMode = 'all' | 'spotAndPerps' | 'historical';

// --- Connection Management ---
export interface ConnectionInfo {
  id: string;
  ws: WebSocket | null;
  userAddresses: string[];
  isConnected: boolean;
  reconnectAttempts: number;
  lastHeartbeat: number;
  subscriptionTypes: SubscriptionType[];
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  totalUsers: number;
  messagesReceived: number;
  lastUpdate: string;
  connectionDetails: Map<
    string,
    {
      users: string[];
      status: 'connected' | 'disconnected' | 'reconnecting';
      messagesCount: number;
    }
  >;
}

// --- Token Mapping ---
export interface SpotToken {
  name: string;
  index: number;
  tokenId: string;
  fullName?: string;
}

export interface WsTrade {
  coin: string;
  side: string;
  px: string;
  sz: string;
  hash: string;
  time: number;
  // tid is 50-bit hash of (buyer_oid, seller_oid).
  // For a globally unique trade id, use (block_time, coin, tid)
  tid: number;
  users: [string, string]; // [buyer, seller]
}

// Snapshot feed, pushed on each block that is at least 0.5 since last push
export interface WsBook {
  coin: string;
  levels: [Array<WsLevel>, Array<WsLevel>];
  time: number;
}

export interface WsBbo {
  coin: string;
  time: number;
  bbo: [WsLevel | null, WsLevel | null];
}

export interface WsLevel {
  px: string; // price
  sz: string; // size
  n: number; // number of orders
}

export interface Notification {
  notification: string;
}

export interface AllMids {
  mids: Record<string, string>;
}

export interface AllMidsMessage extends WebSocketMessage {
  channel: 'allMids';
  data: AllMids;
}

export interface Candle {
  t: number; // open millis
  T: number; // close millis
  s: string; // coin
  i: string; // interval
  o: number; // open price
  c: number; // close price
  h: number; // high price
  l: number; // low price
  v: number; // volume (base unit)
  n: number; // number of trades
}

export type WsUserEvent =
  | { fills: WsFill[] }
  | { funding: WsUserFunding }
  | { liquidation: WsLiquidation }
  | { nonUserCancel: WsNonUserCancel[] };

export interface WsUserFills {
  isSnapshot?: boolean;
  user: string;
  fills: Array<WsFill>;
}

export interface WsFill {
  coin: string;
  px: string; // price
  sz: string; // size
  side: string;
  time: number;
  startPosition: string;
  dir: string; // used for frontend display
  closedPnl: string;
  hash: string; // L1 transaction hash
  oid: number; // order id
  crossed: boolean; // whether order crossed the spread (was taker)
  fee: string; // negative means rebate
  tid: number; // unique trade id
  liquidation?: FillLiquidation;
  feeToken: string; // the token the fee was paid in
  builderFee?: string; // amount paid to builder, also included in fee
}

export interface FillLiquidation {
  liquidatedUser?: string;
  markPx: number;
  method: 'market' | 'backstop';
}

export interface WsUserFunding {
  time: number;
  coin: string;
  usdc: string;
  szi: string;
  fundingRate: string;
}

export interface WsLiquidation {
  lid: number;
  liquidator: string;
  liquidated_user: string;
  liquidated_ntl_pos: string;
  liquidated_account_value: string;
}

export interface WsNonUserCancel {
  coin: String;
  oid: number;
}

export interface WsOrder {
  order: WsBasicOrder;
  status: string; // Possible values: open, filled, canceled, triggered, rejected, marginCanceled
  statusTimestamp: number;
}

export interface WsBasicOrder {
  coin: string;
  side: string;
  limitPx: string;
  sz: string;
  oid: number;
  timestamp: number;
  origSz: string;
  cloid: string | undefined;
}

export interface WsActiveAssetCtx {
  coin: string;
  ctx: PerpsAssetCtx;
}

export interface WsActiveSpotAssetCtx {
  coin: string;
  ctx: SpotAssetCtx;
}

type SharedAssetCtx = {
  dayNtlVlm: number;
  prevDayPx: number;
  markPx: number;
  midPx?: number;
};

type PerpsAssetCtx = SharedAssetCtx & {
  funding: number;
  openInterest: number;
  oraclePx: number;
};

type SpotAssetCtx = SharedAssetCtx & {
  circulatingSupply: number;
};

export type Leverage = 'Cross' | 'Isolated';

export interface WsActiveAssetData {
  user: string;
  coin: string;
  leverage: Leverage;
  maxTradeSzs: [number, number];
  availableToTrade: [number, number];
}

export interface WsTwapSliceFill {
  fill: WsFill;
  twapId: number;
}

export interface WsUserTwapSliceFills {
  isSnapshot?: boolean;
  user: string;
  twapSliceFills: Array<WsTwapSliceFill>;
}

export interface TwapState {
  coin: string;
  user: string;
  side: string;
  sz: number;
  executedSz: number;
  executedNtl: number;
  minutes: number;
  reduceOnly: boolean;
  randomize: boolean;
  timestamp: number;
}

type TwapStatus = 'activated' | 'terminated' | 'finished' | 'error';
export interface WsTwapHistory {
  state: TwapState;
  status: {
    status: TwapStatus;
    description: string;
  };
  time: number;
}

export interface WsUserTwapHistory {
  isSnapshot?: boolean;
  user: string;
  history: Array<WsTwapHistory>;
}

// Types based on actual WebSocket data from 20250625.json
export interface MarginSummary {
  accountValue: string;
  totalMarginUsed: string;
  totalNtlPos: string;
  totalRawUsd: string;
}

export interface CrossMarginSummary {
  accountValue: string;
  totalMarginUsed: string;
  totalNtlPos: string;
  totalRawUsd: string;
}

export interface ClearinghouseState {
  marginSummary: MarginSummary;
  crossMarginSummary: CrossMarginSummary;
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  assetPositions: any[];
  time: number;
}

export interface SpotBalance {
  coin: string;
  token: number;
  total: string;
  hold: string;
  entryNtl: string;
}

export interface SpotState {
  balances: SpotBalance[];
}

export interface WebData2Data {
  method?: string;
  subscription?: {
    type: string;
    user: string;
  };
  agentAddress: any;
  agentValidUntil: any;
  assetCtxs: any[];
  clearinghouseState: ClearinghouseState;
  cumLedger: string;
  isVault: boolean;
  leadingVaults: any[];
  meta: {
    universe: any[];
    marginTables: any[];
  };
  openOrders: any[];
  perpsAtOpenInterestCap: string[];
  serverTime: number;
  spotAssetCtxs: any[];
  spotState: SpotState;
  totalVaultEquity: string;
  twapStates: any[];
  user: string;
}

export interface WebData2Message extends WebSocketMessage {
  channel: 'webData2';
  data: {
    user: string;
    serverTime: number;
    clearinghouseState?: {
      marginSummary?: {
        accountValue: string;
        totalNtlPos: string;
        totalRawUsd: string;
        totalMarginUsed: string;
      };
      crossMarginSummary?: {
        accountValue: string;
        totalNtlPos: string;
        totalRawUsd: string;
        totalMarginUsed: string;
      };
      withdrawable?: string;
    };
    spotState?: {
      balances: SpotBalance[];
    };
  };
}

export interface WebSocketMessage {
  channel: string;
  data: any;
}

export interface LowestValueEvent {
  timestamp: string;
  accountValue: number;
  messageCount: number;
  rawData: any;
}
