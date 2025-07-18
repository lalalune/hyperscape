#!/usr/bin/env -S npx tsx

/**
 * Test database isolation
 */

import { getDB } from './src/server/db.js';
import fs from 'fs-extra';

async function testDatabaseIsolation() {
  console.log('🧪 Testing Database Isolation');
  console.log('=============================');

  try {
    // Clean up
    await fs.remove('./test-db1.sqlite');
    await fs.remove('./test-db2.sqlite');

    console.log('Creating first database...');
    const db1 = await getDB('./test-db1.sqlite');
    
    console.log('Creating second database...');
    const db2 = await getDB('./test-db2.sqlite');
    
    console.log('DB1 === DB2:', db1 === db2);
    
    // Check if files exist
    const db1Exists = await fs.pathExists('./test-db1.sqlite');
    const db2Exists = await fs.pathExists('./test-db2.sqlite');
    
    console.log('DB1 file exists:', db1Exists);
    console.log('DB2 file exists:', db2Exists);
    
    // Clean up
    await fs.remove('./test-db1.sqlite');
    await fs.remove('./test-db2.sqlite');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

await testDatabaseIsolation();