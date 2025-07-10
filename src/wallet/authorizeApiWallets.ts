/**
 * Using the master account wallet to authorize another address as a API Wallet
 *
 * cli 'src//authorizeApiWallets.ts'
 */

import { HttpTransport, ExchangeClient } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';

const MASTER_PRIVATE_KEY = '';
const API_WALLET_1_ADDRESS = '0x0000000000000000000000000000000000000000';

const main = async () => {
  const wallet = privateKeyToAccount(`0x${MASTER_PRIVATE_KEY}`);

  const transport = new HttpTransport({ isTestnet: true });
  const exchClient = new ExchangeClient({
    transport,
    wallet,
    isTestnet: true,
  });

  const agentAddress = API_WALLET_1_ADDRESS;
  const agentName = 'Agent 1'; // important for API wallet revoke

  await exchClient.approveAgent({
    agentAddress,
    agentName,
  });
};

main()
  .then(() => {
    console.log('done');
  })
  .catch((error) => {
    console.error(error);
  });
