/**
 * Using Info API to retrieve user portfolio
 *
 * cli 'src/portfolio/getUserPortfolio.ts'
 */

import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import fs from 'node:fs';
import path from 'node:path';

const TARGET_WALLET_ADDRESS = '0x0000000000000000000000000000000000000000';

const main = async () => {
  const transport = new HttpTransport({ isTestnet: true });
  const infoClient = new InfoClient({
    transport,
  });

  const res = await infoClient.portfolio({
    user: TARGET_WALLET_ADDRESS,
  });

  // Print the data to console
  console.log(JSON.stringify(res, null, 2));

  // Create timestamp for file naming
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYMMDD format
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS format

  // Create directory path
  const portfolioDir = path.join(__dirname, '..', 'portfolio', dateStr);
  const fileName = `${dateStr}-${timeStr}.json`;
  const filePath = path.join(portfolioDir, fileName);

  // Create directory if it doesn't exist
  if (!fs.existsSync(portfolioDir)) {
    fs.mkdirSync(portfolioDir, { recursive: true });
    console.log(`📁 Created directory: ${portfolioDir}`);
  }

  // Save data to JSON file
  fs.writeFileSync(filePath, JSON.stringify(res, null, 2));
  console.log(`💾 Saved portfolio data to: ${filePath}`);
};

main()
  .then(() => {
    console.log('done');
  })
  .catch((error) => {
    console.error(error);
  });
