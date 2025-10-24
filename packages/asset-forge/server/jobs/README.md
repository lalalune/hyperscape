# Blob Cleanup Job System

## Overview

The Blob Cleanup Job system automatically detects and removes orphaned blobs from Vercel Blob Storage. Orphaned blobs are files that exist in storage but are no longer referenced in the migration tracking data.

## Components

### 1. BlobCleanupJob Class (`blobCleanup.mjs`)

The core cleanup logic with two main methods:

- **`detectOrphanedBlobs()`** - Scans all blobs and identifies orphans
- **`cleanupOrphanedBlobs(options)`** - Deletes orphaned blobs older than specified age

### 2. Vercel Cron Endpoint (`/api/cleanup.mjs`)

Serverless function that runs on a schedule (2 AM daily) to automatically clean up orphaned blobs.

### 3. CLI Tool (`scripts/cleanup-blobs.mjs`)

Manual cleanup tool with three modes:
- **Detect Mode** - Only scan for orphans
- **Dry Run Mode** - Show what would be deleted
- **Execute Mode** - Actually delete orphaned blobs

## How It Works

### Detection Algorithm

1. **Fetch All Blobs**: Query Vercel Blob Storage for all stored blobs
2. **Load Tracking Data**: Read migration data from `blob-assets.json`
3. **Build Reference Set**: Extract all blob URLs from migration data
4. **Identify Orphans**: Find blobs not present in reference set
5. **Age Filter**: Filter orphans by age threshold (default: 24 hours)

### Safety Features

- **Age Threshold**: Only deletes blobs older than specified age (prevents premature deletion during uploads)
- **Dry Run Mode**: Preview what would be deleted before executing
- **Error Handling**: Continues cleanup even if individual deletions fail
- **Detailed Logging**: Reports all operations with timestamps and sizes
- **Authentication**: Cron endpoint requires secret token for security

## Usage

### CLI Commands

```bash
# Detect orphaned blobs only
npm run blob:cleanup

# See what would be deleted (dry run)
npm run blob:cleanup:dry-run

# Actually delete orphaned blobs
npm run blob:cleanup:execute

# Custom max age (in hours)
node scripts/cleanup-blobs.mjs --execute --max-age=48
```

### Cron Schedule

The automated cleanup runs daily at 2 AM UTC:

```json
{
  "crons": [{
    "path": "/api/cleanup",
    "schedule": "0 2 * * *"
  }]
}
```

### Manual API Call

You can also trigger cleanup via API:

```bash
curl -X POST https://your-domain.vercel.app/api/cleanup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Required for blob operations
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

# Required for cron endpoint security
CRON_SECRET=your_secure_random_secret

# Migration data location
MIGRATION_LOG_PATH=/tmp/blob-assets.json
```

Generate secure `CRON_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Vercel Configuration

In `vercel.json`:

```json
{
  "functions": {
    "api/cleanup.mjs": {
      "memory": 1024,
      "maxDuration": 60,
      "includeFiles": "data/blob-*.json"
    }
  },
  "crons": [{
    "path": "/api/cleanup",
    "schedule": "0 2 * * *"
  }]
}
```

## Output Examples

### Detection Mode

```
🔍 Scanning for orphaned blobs...
Found 150 total blobs in storage
Found 145 tracked blob URLs in migration data
Detected 5 orphaned blobs

📊 Detection Results:
   Total blobs: 150
   Tracked: 145
   Orphans: 5

Orphaned blobs:
  - assets/old-model-123/model.glb (48h old, 2.45 MB)
  - assets/temp-upload/texture.png (26h old, 512 KB)
  - ...
```

### Dry Run Mode

```
🧪 DRY RUN MODE - No blobs will be deleted
   Max age: 24 hours

🔍 Scanning for orphaned blobs...
Found 5 orphaned blobs older than 24 hours

🧪 DRY RUN - Would delete:
  - assets/old-model-123/model.glb (48h old, 2.45 MB)
  - assets/temp-upload/texture.png (26h old, 512 KB)

📊 Dry Run Results:
   Would delete: 2 blobs
```

### Execute Mode

```
⚠️  EXECUTE MODE - Will delete orphaned blobs
   Max age: 24 hours

🔍 Scanning for orphaned blobs...
Found 2 orphaned blobs older than 24 hours

✅ Deleted orphaned blob: assets/old-model-123/model.glb (48h old, 2.45 MB)
✅ Deleted orphaned blob: assets/temp-upload/texture.png (26h old, 512 KB)

🧹 Cleanup complete: 2 deleted, 0 errors

📊 Cleanup Results:
   Deleted: 2
   Errors: 0
```

## Verification

The system includes a blob reference verification method in `BlobAssetService`:

```javascript
// Verify all blob references are still accessible
const brokenRefs = await blobService.verifyBlobReferences()
if (brokenRefs.length > 0) {
  console.log('Found broken references:', brokenRefs)
}
```

This checks if all URLs in migration data still exist in blob storage.

## When Blobs Become Orphaned

Blobs can become orphaned in several scenarios:

1. **Failed Uploads**: Upload completes but metadata save fails
2. **Partial Deletions**: Asset deleted from migration data but blob deletion fails
3. **Manual Operations**: Direct blob operations outside the system
4. **Migration Issues**: Problems during blob migration process
5. **Development Testing**: Test uploads that aren't properly cleaned up

## Best Practices

1. **Always Dry Run First**: Use `--dry-run` to preview before executing
2. **Monitor Logs**: Check cleanup logs for unexpected orphans
3. **Adjust Age Threshold**: Increase age threshold during heavy upload periods
4. **Regular Verification**: Run `verifyBlobReferences()` periodically
5. **Backup Before Cleanup**: Consider blob backups for production systems

## Troubleshooting

### No Orphans Found But Storage Is Full

- Check if migration data is complete
- Verify `MIGRATION_LOG_PATH` is correct
- Run `verifyBlobReferences()` to check for broken links

### Cleanup Fails With 401 Error

- Verify `BLOB_READ_WRITE_TOKEN` is set and valid
- Check token has delete permissions
- Ensure token isn't expired

### Cron Job Not Running

- Verify `CRON_SECRET` matches in Vercel environment
- Check Vercel cron logs in dashboard
- Ensure cron schedule is valid

### Too Many Orphans Detected

- May indicate migration data corruption
- Check if `blob-assets.json` is being properly saved
- Review recent deletion operations

## Development

To add new cleanup logic:

1. Extend `BlobCleanupJob` class
2. Add new detection methods
3. Update CLI tool to expose new options
4. Add tests for new functionality

Example:

```javascript
async cleanupByPattern(pattern, options = {}) {
  const { blobs } = await list({
    token: process.env.BLOB_READ_WRITE_TOKEN
  })

  const matching = blobs.filter(blob =>
    blob.pathname.match(pattern)
  )

  // ... cleanup logic
}
```

## Security Considerations

1. **Authentication**: Cron endpoint requires bearer token
2. **Rate Limiting**: Built-in Vercel rate limits prevent abuse
3. **Audit Trail**: All operations are logged
4. **Dry Run Default**: Requires explicit flag for deletion
5. **Age Threshold**: Prevents accidental deletion of recent uploads

## Performance

- **Scan Time**: ~1-2 seconds per 1000 blobs
- **Deletion Time**: ~100-200ms per blob
- **Memory Usage**: ~50MB for 10,000 blobs
- **Timeout**: 60 seconds max (Vercel function limit)

For very large blob stores (>10,000 blobs), consider:
- Batch processing
- Pagination
- Incremental cleanup
- Off-peak scheduling

## Future Improvements

- [ ] Batch deletion API
- [ ] Cleanup analytics dashboard
- [ ] Email notifications for large cleanups
- [ ] Blob size optimization suggestions
- [ ] Automatic backup before deletion
- [ ] Undo/restore deleted blobs
- [ ] Pattern-based cleanup rules
- [ ] Custom retention policies
