# Cloudflare R2 Storage Integration Guide

This guide explains how to migrate from local file storage to Cloudflare R2 for scalable, zero-egress asset storage.

## Why Cloudflare R2?

- **Zero egress fees** - No charges for data transfer out
- **S3-compatible** - Drop-in replacement using AWS SDK
- **Low storage costs** - $0.015/GB/month ($15/TB)
- **10GB free tier** - Great for getting started
- **Global CDN** - Fast asset delivery worldwide
- **Public URLs** - Direct links for Meshy.ai access

## Setup Cloudflare R2

### 1. Create R2 Bucket

1. Go to https://dash.cloudflare.com/
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Name: `asset-forge-assets` (or your preferred name)
5. Choose location hint (optional)
6. Click **Create bucket**

### 2. Generate API Tokens

1. In R2 dashboard, go to **Manage R2 API Tokens**
2. Click **Create API token**
3. Name: `asset-forge-api`
4. Permissions: **Object Read & Write**
5. Select your bucket or choose **All buckets**
6. Click **Create API token**
7. **Save these credentials** (shown only once):
   - Access Key ID
   - Secret Access Key
   - Account ID (from R2 dashboard)

### 3. Configure Public Access (Optional)

For public asset URLs:

1. In your bucket settings, go to **Settings**
2. Under **Public access**, click **Allow Access**
3. Configure custom domain or use default `*.r2.dev` URL

## Install Dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
```

## Environment Variables

Add to Railway environment variables:

```env
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=asset-forge-assets
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
# Or your custom domain:
# R2_PUBLIC_URL=https://assets.yourdomain.com
```

## Implementation

### Create R2 Client

Create `server/utils/r2-client.mjs`:

```javascript
/**
 * Cloudflare R2 Storage Client
 * S3-compatible object storage with zero egress
 */

import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

// Initialize R2 client
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'asset-forge-assets'
const PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://pub-xxxxx.r2.dev`

/**
 * Upload file to R2
 * @param {string} key - Object key (path in bucket)
 * @param {Buffer|Stream} body - File content
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public URL of uploaded file
 */
export async function uploadToR2(key, body, contentType = 'application/octet-stream') {
  try {
    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Make public (optional)
        // ACL: 'public-read' // R2 doesn't use ACLs, configure bucket settings instead
      }
    })

    await upload.done()

    // Return public URL
    return `${PUBLIC_URL}/${key}`
  } catch (error) {
    console.error('[R2] Upload failed:', error)
    throw error
  }
}

/**
 * Get file from R2
 * @param {string} key - Object key
 * @returns {Promise<Buffer>} File content
 */
export async function getFromR2(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    })

    const response = await r2Client.send(command)
    const chunks = []

    for await (const chunk of response.Body) {
      chunks.push(chunk)
    }

    return Buffer.concat(chunks)
  } catch (error) {
    console.error('[R2] Get failed:', error)
    throw error
  }
}

/**
 * Delete file from R2
 * @param {string} key - Object key
 * @returns {Promise<void>}
 */
export async function deleteFromR2(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    })

    await r2Client.send(command)
  } catch (error) {
    console.error('[R2] Delete failed:', error)
    throw error
  }
}

/**
 * Get public URL for a file
 * @param {string} key - Object key
 * @returns {string} Public URL
 */
export function getR2PublicUrl(key) {
  return `${PUBLIC_URL}/${key}`
}

export default {
  uploadToR2,
  getFromR2,
  deleteFromR2,
  getR2PublicUrl,
  client: r2Client
}
```

### Update Asset Storage

Modify asset generation to use R2:

```javascript
import { uploadToR2, getR2PublicUrl } from './utils/r2-client.mjs'
import fs from 'fs'
import path from 'path'

// Example: Upload generated 3D model
async function saveGeneratedAsset(assetId, modelBuffer, metadata) {
  const key = `assets/${assetId}/model.glb`

  // Upload to R2
  const publicUrl = await uploadToR2(key, modelBuffer, 'model/gltf-binary')

  // Save metadata to database
  await query(
    `UPDATE assets SET file_url = $1, updated_at = NOW() WHERE id = $2`,
    [publicUrl, assetId]
  )

  console.log(`[Assets] Uploaded to R2: ${publicUrl}`)
  return publicUrl
}

// Example: Upload temporary image for Meshy.ai
async function saveTempImage(imageBuffer) {
  const filename = `temp/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`
  const publicUrl = await uploadToR2(filename, imageBuffer, 'image/png')

  // Meshy.ai can now access this public URL
  return publicUrl
}
```

### Gradual Migration Strategy

To migrate existing assets without downtime:

```javascript
import { uploadToR2, getR2PublicUrl } from './utils/r2-client.mjs'
import path from 'path'
import fs from 'fs'

/**
 * Dual storage: Try R2 first, fallback to local files
 */
async function getAsset(assetId) {
  // Try R2
  if (process.env.R2_ENABLED === 'true') {
    try {
      const key = `assets/${assetId}/model.glb`
      return getR2PublicUrl(key)
    } catch (error) {
      console.log('[Assets] R2 not found, trying local...')
    }
  }

  // Fallback to local
  const localPath = path.join(process.cwd(), 'gdd-assets', assetId, 'model.glb')
  if (fs.existsSync(localPath)) {
    return `/api/assets/${assetId}/model`
  }

  throw new Error('Asset not found')
}

/**
 * Migrate existing assets to R2
 */
async function migrateAssetsToR2() {
  const assetsDir = path.join(process.cwd(), 'gdd-assets')
  const assetIds = fs.readdirSync(assetsDir)

  for (const assetId of assetIds) {
    const modelPath = path.join(assetsDir, assetId, 'model.glb')

    if (fs.existsSync(modelPath)) {
      const modelBuffer = fs.readFileSync(modelPath)
      const key = `assets/${assetId}/model.glb`

      console.log(`[Migration] Uploading ${assetId}...`)
      await uploadToR2(key, modelBuffer, 'model/gltf-binary')

      // Update database
      await query(
        `UPDATE assets SET file_url = $1 WHERE id = $2`,
        [getR2PublicUrl(key), assetId]
      )
    }
  }

  console.log('[Migration] All assets migrated to R2')
}
```

## Custom Domain (Optional)

To use your own domain for R2:

1. In Cloudflare dashboard, go to your domain
2. Add CNAME record:
   ```
   assets.yourdomain.com → bucket-name.r2.dev
   ```
3. In R2 bucket settings, add custom domain: `assets.yourdomain.com`
4. Update `R2_PUBLIC_URL` environment variable

## Cost Calculator

Example costs for 1TB storage, 10TB egress:

| Provider | Storage | Egress | Total/month |
|----------|---------|--------|-------------|
| AWS S3   | $23     | $920   | $943        |
| Cloudflare R2 | $15 | $0     | $15         |
| **Savings** | -$8  | **-$920** | **-$928** |

R2 saves **98%** on high-egress workloads!

## Testing

Test R2 integration locally:

```javascript
// test-r2.mjs
import { uploadToR2, getFromR2, deleteFromR2, getR2PublicUrl } from './server/utils/r2-client.mjs'

async function test() {
  const testData = Buffer.from('Hello R2!')
  const key = 'test/hello.txt'

  // Upload
  const url = await uploadToR2(key, testData, 'text/plain')
  console.log('Uploaded:', url)

  // Retrieve
  const data = await getFromR2(key)
  console.log('Retrieved:', data.toString())

  // Delete
  await deleteFromR2(key)
  console.log('Deleted')
}

test().catch(console.error)
```

Run: `node test-r2.mjs`

## Monitoring

Track R2 usage in Cloudflare dashboard:
- Storage: Current GB stored
- Requests: Read/write operations
- Bandwidth: Data transfer (ingress only)

## Troubleshooting

### Access Denied
- Verify API tokens are correct
- Check token permissions include bucket access
- Ensure bucket name matches

### CORS Errors
Configure CORS in R2 bucket settings:
```json
[
  {
    "AllowedOrigins": ["https://your-frontend.vercel.app"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### Slow Uploads
- Use `@aws-sdk/lib-storage` for multipart uploads
- Enable connection pooling
- Consider using Cloudflare Workers for server-side processing

## Best Practices

1. **Use descriptive keys**: `assets/{id}/model.glb` instead of random hashes
2. **Set proper Content-Type**: Enables browser rendering
3. **Implement cleanup**: Delete unused assets to save costs
4. **Use lifecycle rules**: Auto-delete old temp files
5. **Monitor costs**: Set up Cloudflare billing alerts
6. **Cache URLs**: Store public URLs in database

## Next Steps

1. Set up R2 bucket and API tokens
2. Add environment variables to Railway
3. Create `r2-client.mjs` utility
4. Test with a single asset upload
5. Gradually migrate existing assets
6. Update frontend to use R2 URLs
7. Remove local file storage once migration complete
