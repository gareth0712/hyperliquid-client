/**
 * Using the master account wallet to revoke another address's API Wallet access
 *
 * cli 'src//revokeApiWallet.ts'
 */

import { HttpTransport, ExchangeClient } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';

const MASTER_PRIVATE_KEY = '';
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const main = async () => {
  const wallet = privateKeyToAccount(`0x${MASTER_PRIVATE_KEY}`);

  const transport = new HttpTransport({ isTestnet: true });
  const exchClient = new ExchangeClient({
    transport,
    wallet,
    isTestnet: true,
  });

  const agentAddress = NULL_ADDRESS;
  const agentName = 'Agent 1'; // authorized agent name

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
