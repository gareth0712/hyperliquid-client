/**
 * Creating Info API and Exchange API client
 * Use `isTestnet: true` option for Testnet
 *
 * cli 'src/exchange/apiClient.ts'
 */

import { HttpTransport, InfoClient, ExchangeClient } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';

const MASTER_PRIVATE_KEY = '';

const main = async () => {
  // include `{ isTestnet: true }` for testnet
  const transport = new HttpTransport({ isTestnet: true });

  // Public API, no wallet signing is required
  const infoClient = new InfoClient({
    transport,
  });

  // Exchange API require a wallet for signing, `{ isTestnet: true }` for testnet
  const wallet = privateKeyToAccount(`0x${MASTER_PRIVATE_KEY}`);
  const exchClient = new ExchangeClient({
    transport,
    wallet,
    isTestnet: true,
  });
};

main()
  .then(() => {
    console.log('done');
  })
  .catch((error) => {
    console.error(error);
  });
