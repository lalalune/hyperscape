#!/usr/bin/env node
/**
 * Tigris S3 Connection Test
 *
 * Tests connection to Tigris S3 storage and verifies credentials
 *
 * Usage:
 *   node scripts/test-tigris-connection.mjs
 */

import { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

config();

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_ENDPOINT_URL_S3,
  BUCKET_NAME
} = process.env;

console.log('========================================');
console.log('Tigris S3 Connection Test');
console.log('========================================\n');

// Check credentials
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error('❌ Missing AWS credentials');
  console.error('Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env');
  process.exit(1);
}

if (!AWS_ENDPOINT_URL_S3) {
  console.error('❌ Missing AWS_ENDPOINT_URL_S3');
  console.error('Set AWS_ENDPOINT_URL_S3=https://fly.storage.tigris.dev in .env');
  process.exit(1);
}

if (!BUCKET_NAME) {
  console.error('❌ Missing BUCKET_NAME');
  console.error('Set BUCKET_NAME in .env');
  process.exit(1);
}

console.log('✅ Credentials found');
console.log(`   Access Key: ${AWS_ACCESS_KEY_ID.substring(0, 10)}...`);
console.log(`   Endpoint:   ${AWS_ENDPOINT_URL_S3}`);
console.log(`   Bucket:     ${BUCKET_NAME}\n`);

// Create S3 client
const s3Client = new S3Client({
  region: 'auto',
  endpoint: AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function testConnection() {
  try {
    // Test 1: List buckets
    console.log('Test 1: Listing buckets...');
    const listCommand = new ListBucketsCommand({});
    const listResponse = await s3Client.send(listCommand);
    console.log(`✅ Listed ${listResponse.Buckets?.length || 0} buckets`);

    if (listResponse.Buckets) {
      listResponse.Buckets.forEach(bucket => {
        console.log(`   - ${bucket.Name}`);
      });
    }
    console.log();

    // Test 2: Upload test file
    console.log('Test 2: Uploading test file...');
    const testKey = 'test/connection-test.txt';
    const testContent = `Tigris connection test - ${new Date().toISOString()}`;

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });

    await s3Client.send(putCommand);
    console.log(`✅ Uploaded test file: ${testKey}\n`);

    // Test 3: Download test file
    console.log('Test 3: Downloading test file...');
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });

    const getResponse = await s3Client.send(getCommand);
    const downloadedContent = await getResponse.Body.transformToString();

    if (downloadedContent === testContent) {
      console.log('✅ Downloaded and verified content\n');
    } else {
      console.error('❌ Content mismatch');
      process.exit(1);
    }

    // Test 4: Delete test file
    console.log('Test 4: Deleting test file...');
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });

    await s3Client.send(deleteCommand);
    console.log('✅ Deleted test file\n');

    // Success
    console.log('========================================');
    console.log('✅ All tests passed!');
    console.log('========================================');
    console.log('\nTigris S3 connection is working correctly.');
    console.log('You can now:');
    console.log('  1. Upload assets with: node scripts/sync-to-tigris.mjs');
    console.log('  2. Deploy to Fly.io: fly deploy');
    console.log();

  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error(`   ${error.message}`);

    if (error.Code === 'NoSuchBucket') {
      console.error('\nThe bucket does not exist. Create it with:');
      console.error('  fly storage create');
    } else if (error.Code === 'InvalidAccessKeyId') {
      console.error('\nInvalid access key. Check your AWS_ACCESS_KEY_ID.');
    } else if (error.Code === 'SignatureDoesNotMatch') {
      console.error('\nInvalid secret key. Check your AWS_SECRET_ACCESS_KEY.');
    }

    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testConnection();
