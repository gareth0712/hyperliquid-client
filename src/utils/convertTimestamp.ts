/**
 * Convert timestamps in portfolio data to locale time (GMT+8)
 *
 * cli 'src/portfolio/convertTimestamp.ts'
 */

import fs from 'node:fs';
import path from 'node:path';

const convertTimestampToLocaleTime = (timestamp: number): string => {
  const date = new Date(timestamp);

  // Convert to GMT+8
  const gmt8Offset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
  const gmt8Date = new Date(date.getTime() + gmt8Offset);

  // Format as YYYYMMDDTHH:MM:SSZ+8
  const year = gmt8Date.getUTCFullYear();
  const month = String(gmt8Date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(gmt8Date.getUTCDate()).padStart(2, '0');
  const hours = String(gmt8Date.getUTCHours()).padStart(2, '0');
  const minutes = String(gmt8Date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(gmt8Date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}:${minutes}:${seconds}Z+8`;
};

const convertPortfolioData = (data: any[]): any[] => {
  return data.map(([period, periodData]) => {
    const convertedPeriodData = { ...periodData };

    // Convert accountValueHistory timestamps
    if (periodData.accountValueHistory) {
      convertedPeriodData.accountValueHistory = periodData.accountValueHistory.map(([timestamp, value]: [number, string]) => [
        convertTimestampToLocaleTime(timestamp),
        value,
      ]);
    }

    // Convert pnlHistory timestamps
    if (periodData.pnlHistory) {
      convertedPeriodData.pnlHistory = periodData.pnlHistory.map(([timestamp, value]: [number, string]) => [
        convertTimestampToLocaleTime(timestamp),
        value,
      ]);
    }

    return [period, convertedPeriodData];
  });
};

const processDirectory = (sourceDir: string, targetDir: string) => {
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Source directory not found: ${sourceDir}`);
    return;
  }

  // Create target directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`📁 Created target directory: ${targetDir}`);
  }

  const processFile = (filePath: string) => {
    const relativePath = path.relative(sourceDir, filePath);
    const targetPath = path.join(targetDir, relativePath);
    const targetFileDir = path.dirname(targetPath);

    // Create target subdirectory if it doesn't exist
    if (!fs.existsSync(targetFileDir)) {
      fs.mkdirSync(targetFileDir, { recursive: true });
    }

    try {
      // Read and parse the JSON data
      const rawData = fs.readFileSync(filePath, 'utf8');
      const portfolioData = JSON.parse(rawData);

      // Convert the timestamps
      const convertedData = convertPortfolioData(portfolioData);

      // Save converted data
      fs.writeFileSync(targetPath, JSON.stringify(convertedData, null, 2));

      console.log(`✅ Converted: ${relativePath}`);
    } catch (error) {
      console.error(`❌ Error processing ${relativePath}:`, error);
    }
  };

  const walkDirectory = (dir: string) => {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walkDirectory(fullPath);
      } else if (item.endsWith('.json')) {
        processFile(fullPath);
      }
    }
  };

  console.log(`🔄 Processing all JSON files in: ${sourceDir}`);
  walkDirectory(sourceDir);
  console.log(`📁 Converted files saved to: ${targetDir}`);
};

const main = async () => {
  const sourceDir = path.join(__dirname, '..', 'portfolio');
  const targetDir = path.join(__dirname, '..', 'convertedPortfolio');

  processDirectory(sourceDir, targetDir);

  // Show a sample of the conversion
  console.log('\n📊 Sample conversion:');
  console.log('Original:');
  console.log('  [1750761859574, "933.395105"]');
  console.log('Converted:');
  console.log(`  ["${convertTimestampToLocaleTime(1750761859574)}", "933.395105"]`);
};

main()
  .then(() => {
    console.log('done');
  })
  .catch((error) => {
    console.error(error);
  });
