/**
 * Copy account value history to Google Sheets format
 *
 * cli 'src/portfolio/copyToExcel.ts'
 */

import fs from 'node:fs';
import path from 'node:path';

interface AccountValueEntry {
  timestamp: string;
  value: string;
}

const parseTimestamp = (timestampStr: string): { date: string; time: string } => {
  // Parse timestamp in format "20250624T18:44:19Z+8"
  const match = timestampStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2}):(\d{2})Z\+8$/);
  
  if (!match) {
    throw new Error(`Invalid timestamp format: ${timestampStr}`);
  }
  
  const [, year, month, day, hour, minute, second] = match;
  
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}:${second}`,
  };
};

const extractAllTimeAccountValueHistory = (data: any[]): AccountValueEntry[] => {
  // Find the "allTime" entry
  const allTimeEntry = data.find(([period]) => period === 'allTime');
  
  if (!allTimeEntry) {
    throw new Error('No "allTime" data found in portfolio');
  }
  
  const [, periodData] = allTimeEntry;
  
  if (!periodData.accountValueHistory) {
    throw new Error('No accountValueHistory found in allTime data');
  }
  
  return periodData.accountValueHistory.map(([timestamp, value]: [string, string]) => ({
    timestamp,
    value,
  }));
};

const printGoogleSheetsFormat = (accountValueHistory: AccountValueEntry[]) => {
  // Print header
  console.log('Date\tTime\tAccount Value');
  
  // Print data rows
  accountValueHistory.forEach(({ timestamp, value }) => {
    const { date, time } = parseTimestamp(timestamp);
    const numericValue = parseFloat(value).toFixed(6);
    
    console.log(`${date}\t${time}\t${numericValue}`);
  });
};

const main = async () => {
  try {
    // Find the most recent converted portfolio file
    const convertedDir = path.join(__dirname, '..', 'convertedPortfolio');
    
    if (!fs.existsSync(convertedDir)) {
      console.error(`❌ Converted portfolio directory not found: ${convertedDir}`);
      console.log('💡 Please run convertTimestamp.ts first to create converted files');
      return;
    }
    
    // Find all JSON files in the converted directory
    const findJsonFiles = (dir: string): string[] => {
      const files: string[] = [];
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...findJsonFiles(fullPath));
        } else if (item.endsWith('.json')) {
          files.push(fullPath);
        }
      }
      
      return files;
    };
    
    const jsonFiles = findJsonFiles(convertedDir);
    
    if (jsonFiles.length === 0) {
      console.error('❌ No JSON files found in converted portfolio directory');
      return;
    }
    
    // Sort files by modification time (most recent first)
    jsonFiles.sort((a, b) => {
      const statA = fs.statSync(a);
      const statB = fs.statSync(b);
      return statB.mtime.getTime() - statA.mtime.getTime();
    });
    
    const mostRecentFile = jsonFiles[0];
    const relativePath = path.relative(convertedDir, mostRecentFile);
    
    console.log(`📁 Using most recent file: ${relativePath}`);
    
    // Read and parse the JSON data
    const rawData = fs.readFileSync(mostRecentFile, 'utf8');
    const portfolioData = JSON.parse(rawData);
    
    // Extract all time account value history
    console.log('🔄 Extracting all time account value history...');
    const accountValueHistory = extractAllTimeAccountValueHistory(portfolioData);
    
    console.log(`📊 Found ${accountValueHistory.length} data points`);
    console.log('');
    
    // Print data in Google Sheets format
    console.log('📋 Google Sheets Format (copy and paste into Google Sheets):');
    console.log('='.repeat(80));
    printGoogleSheetsFormat(accountValueHistory);
    console.log('='.repeat(80));
    
    // Show sample data
    console.log('\n📋 Sample data preview:');
    console.log('Date         | Time     | Account Value');
    console.log('-------------|----------|--------------');
    
    const sampleData = accountValueHistory.slice(0, 5);
    sampleData.forEach(({ timestamp, value }) => {
      const { date, time } = parseTimestamp(timestamp);
      const numericValue = parseFloat(value).toFixed(6);
      console.log(`${date} | ${time} | ${numericValue}`);
    });
    
    if (accountValueHistory.length > 5) {
      console.log(`... and ${accountValueHistory.length - 5} more rows`);
    }
    
    console.log('\n💡 Instructions:');
    console.log('1. Copy the data between the "=" lines above');
    console.log('2. Open Google Sheets');
    console.log('3. Paste the data (Ctrl+V or Cmd+V)');
    console.log('4. Google Sheets will automatically separate the columns');
    
  } catch (error) {
    console.error('❌ Error processing data:', error);
  }
};

main()
  .then(() => {
    console.log('done');
  })
  .catch((error) => {
    console.error(error);
  });
