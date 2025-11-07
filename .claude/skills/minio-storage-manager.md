# MinIO Storage Manager

## Activation
When the user mentions any of these, activate this skill:
- "minio storage"
- "minio bucket"
- "s3 compatible storage"
- "object storage railway"
- "minio configuration"
- "minio client setup"
- "minio railway deployment"
- "file upload storage"

## Purpose
Manages MinIO object storage on Railway, including bucket creation, file operations, access control, and integration with applications. Provides S3-compatible storage for file uploads, media assets, backups, and data archiving.

## Context
MinIO is a high-performance, S3-compatible object storage system that can be deployed on Railway with one-click templates. It provides powerful object storage with familiar S3 APIs, making it easy to migrate from AWS S3 or implement object storage in new applications.

## Core Capabilities

### 1. MinIO Deployment on Railway
- Deploy MinIO using Railway templates
- Configure persistent storage volumes
- Set up access credentials
- Configure networking (public/private)

### 2. Bucket Management
- Create and delete buckets
- Configure bucket policies
- Set up bucket versioning
- Configure bucket lifecycle rules

### 3. File Operations
- Upload files and objects
- Download files
- Delete objects
- Generate presigned URLs for temporary access
- Multi-part uploads for large files

### 4. Access Control
- Configure access keys and secrets
- Set up bucket policies
- Configure IAM policies
- Public vs private bucket configuration

### 5. Client Integration
- MinIO JavaScript/TypeScript client
- AWS SDK S3 client (compatible)
- Python boto3 client
- MinIO CLI (mc) operations

## Implementation Patterns

### 1. Deploy MinIO on Railway

```bash
# Option 1: Deploy via Railway Dashboard
# Go to Railway Dashboard → New → Template → Search "MinIO"
# Click deploy and configure:
# - MINIO_ROOT_USER: admin username
# - MINIO_ROOT_PASSWORD: secure password (minimum 8 characters)

# Option 2: Deploy via CLI (using template)
railway up --service=minio
```

### 2. MinIO Configuration (Environment Variables)

```env
# MinIO Credentials
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=your-secure-password-here

# MinIO Endpoint (Private Network)
MINIO_ENDPOINT=${{MinIO.RAILWAY_PRIVATE_DOMAIN}}
MINIO_PORT=${{MinIO.PORT}}
MINIO_USE_SSL=false  # Use false for private network (http://)

# Public Endpoint (for external access)
MINIO_PUBLIC_ENDPOINT=https://${{MinIO.RAILWAY_STATIC_URL}}

# MinIO Server Configuration
MINIO_BROWSER=on  # Enable MinIO Console
MINIO_REGION=us-east-1  # Default region
```

### 3. Application Integration

#### Node.js/TypeScript with MinIO Client

```typescript
import * as Minio from 'minio';

// Configure MinIO client
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ROOT_USER!,
  secretKey: process.env.MINIO_ROOT_PASSWORD!,
});

// Create bucket
async function createBucket(bucketName: string): Promise<void> {
  const exists = await minioClient.bucketExists(bucketName);
  if (!exists) {
    await minioClient.makeBucket(bucketName, 'us-east-1');
    console.log(`Bucket ${bucketName} created successfully`);
  }
}

// Upload file
async function uploadFile(
  bucketName: string,
  objectName: string,
  filePath: string
): Promise<void> {
  await minioClient.fPutObject(bucketName, objectName, filePath);
  console.log(`File uploaded successfully: ${objectName}`);
}

// Upload from buffer
async function uploadBuffer(
  bucketName: string,
  objectName: string,
  buffer: Buffer,
  metadata?: Record<string, string>
): Promise<void> {
  await minioClient.putObject(
    bucketName,
    objectName,
    buffer,
    buffer.length,
    metadata
  );
}

// Download file
async function downloadFile(
  bucketName: string,
  objectName: string,
  filePath: string
): Promise<void> {
  await minioClient.fGetObject(bucketName, objectName, filePath);
  console.log(`File downloaded successfully: ${objectName}`);
}

// Get presigned URL (temporary public access)
async function getPresignedUrl(
  bucketName: string,
  objectName: string,
  expirySeconds: number = 3600
): Promise<string> {
  return await minioClient.presignedGetObject(
    bucketName,
    objectName,
    expirySeconds
  );
}

// List objects in bucket
async function listObjects(
  bucketName: string,
  prefix?: string
): Promise<string[]> {
  const stream = minioClient.listObjectsV2(bucketName, prefix, true);
  const objects: string[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (obj) => objects.push(obj.name));
    stream.on('end', () => resolve(objects));
    stream.on('error', reject);
  });
}

// Delete object
async function deleteObject(
  bucketName: string,
  objectName: string
): Promise<void> {
  await minioClient.removeObject(bucketName, objectName);
  console.log(`Object deleted: ${objectName}`);
}

// Set bucket policy (public read)
async function setPublicReadPolicy(bucketName: string): Promise<void> {
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucketName}/*`],
      },
    ],
  };

  await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
}

// Initialize storage (create default buckets)
export async function initializeStorage(): Promise<void> {
  const buckets = ['uploads', 'avatars', 'documents', 'backups'];

  for (const bucket of buckets) {
    await createBucket(bucket);
  }
}
```

#### Using AWS SDK (S3-Compatible)

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configure S3 client for MinIO
const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER!,
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD!,
  },
  forcePathStyle: true, // Required for MinIO
});

// Upload file
async function uploadFileS3(
  bucket: string,
  key: string,
  body: Buffer,
  contentType?: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);
}

// Generate presigned URL
async function generatePresignedUrl(
  bucket: string,
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}
```

#### Python Integration (boto3)

```python
import boto3
from botocore.client import Config
import os

# Configure MinIO client
s3_client = boto3.client(
    's3',
    endpoint_url=f"http://{os.getenv('MINIO_ENDPOINT')}:{os.getenv('MINIO_PORT')}",
    aws_access_key_id=os.getenv('MINIO_ROOT_USER'),
    aws_secret_access_key=os.getenv('MINIO_ROOT_PASSWORD'),
    config=Config(signature_version='s3v4'),
    region_name='us-east-1'
)

def create_bucket(bucket_name):
    """Create a bucket if it doesn't exist."""
    try:
        s3_client.head_bucket(Bucket=bucket_name)
    except:
        s3_client.create_bucket(Bucket=bucket_name)
        print(f"Bucket {bucket_name} created")

def upload_file(bucket_name, file_path, object_name=None):
    """Upload a file to MinIO bucket."""
    if object_name is None:
        object_name = os.path.basename(file_path)

    s3_client.upload_file(file_path, bucket_name, object_name)
    print(f"File {object_name} uploaded successfully")

def download_file(bucket_name, object_name, file_path):
    """Download a file from MinIO bucket."""
    s3_client.download_file(bucket_name, object_name, file_path)
    print(f"File {object_name} downloaded successfully")

def generate_presigned_url(bucket_name, object_name, expiration=3600):
    """Generate a presigned URL for temporary access."""
    url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket_name, 'Key': object_name},
        ExpiresIn=expiration
    )
    return url

def list_objects(bucket_name, prefix=''):
    """List objects in a bucket."""
    response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
    return [obj['Key'] for obj in response.get('Contents', [])]
```

### 4. MinIO CLI (mc) Commands

```bash
# Install MinIO client
# macOS
brew install minio/stable/mc

# Linux
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Configure MinIO alias
mc alias set railway http://MINIO_ENDPOINT:PORT ACCESS_KEY SECRET_KEY

# Create bucket
mc mb railway/my-bucket

# Upload file
mc cp file.txt railway/my-bucket/

# Download file
mc cp railway/my-bucket/file.txt ./

# List buckets
mc ls railway

# List objects in bucket
mc ls railway/my-bucket

# Remove object
mc rm railway/my-bucket/file.txt

# Set public read policy
mc anonymous set download railway/my-bucket

# Mirror directory to bucket
mc mirror ./local-folder railway/my-bucket

# Set bucket versioning
mc version enable railway/my-bucket
```

### 5. File Upload API Example (Next.js)

```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: parseInt(process.env.MINIO_PORT!),
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER!,
  secretKey: process.env.MINIO_ROOT_PASSWORD!,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate unique filename
    const fileName = `${Date.now()}-${file.name}`;

    // Upload to MinIO
    await minioClient.putObject(
      'uploads',
      fileName,
      buffer,
      buffer.length,
      {
        'Content-Type': file.type,
      }
    );

    // Generate URL (if bucket is public or use presigned URL)
    const url = await minioClient.presignedGetObject(
      'uploads',
      fileName,
      24 * 60 * 60 // 24 hours
    );

    return NextResponse.json({
      success: true,
      fileName,
      url,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
```

## Best Practices

### 1. Security
- **Use strong passwords** for MINIO_ROOT_USER and MINIO_ROOT_PASSWORD
- **Use private networking** for internal service communication
- **Rotate credentials regularly**
- **Use bucket policies** to restrict access
- **Never expose admin credentials** in client-side code
- **Use presigned URLs** for temporary public access instead of making buckets public

### 2. Bucket Organization
- **Create separate buckets** for different content types (uploads, avatars, documents)
- **Use consistent naming conventions** (lowercase, hyphens)
- **Use prefixes/folders** within buckets for organization
- **Example structure**:
  - `uploads/users/{userId}/{fileName}`
  - `avatars/{userId}.jpg`
  - `documents/{companyId}/{documentId}.pdf`

### 3. Performance
- **Use private networking** between Railway services for faster transfers
- **Configure appropriate buffer sizes** for large files
- **Use multipart uploads** for files > 5MB
- **Implement caching** for frequently accessed objects
- **Use CDN** (Cloudflare, etc.) for public assets

### 4. Data Management
- **Enable versioning** for important buckets
- **Set up lifecycle rules** to archive or delete old objects
- **Implement backup strategy** for critical data
- **Monitor storage usage** to manage costs

### 5. Error Handling
- **Always validate file types** before upload
- **Implement retry logic** for failed uploads
- **Handle network errors gracefully**
- **Validate file sizes** before upload
- **Log errors** for debugging

### 6. Cost Optimization
- **Delete unused objects** regularly
- **Compress files** before upload when appropriate
- **Use lifecycle policies** to transition old data
- **Monitor storage usage** in Railway dashboard

## Common Workflows

### 1. Initial Setup

```typescript
// Initialize MinIO storage system
async function setupMinioStorage() {
  // Create required buckets
  const buckets = ['uploads', 'avatars', 'documents', 'backups'];

  for (const bucket of buckets) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket, 'us-east-1');
      console.log(`Created bucket: ${bucket}`);
    }
  }

  // Set public read policy for avatars
  const avatarPolicy = {
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: ['arn:aws:s3:::avatars/*'],
    }],
  };

  await minioClient.setBucketPolicy('avatars', JSON.stringify(avatarPolicy));

  console.log('MinIO storage initialized successfully');
}
```

### 2. User Avatar Upload

```typescript
async function uploadUserAvatar(
  userId: string,
  avatarBuffer: Buffer,
  contentType: string
): Promise<string> {
  const objectName = `${userId}.jpg`;

  await minioClient.putObject(
    'avatars',
    objectName,
    avatarBuffer,
    avatarBuffer.length,
    { 'Content-Type': contentType }
  );

  // Return public URL (if bucket is public)
  return `${process.env.MINIO_PUBLIC_ENDPOINT}/avatars/${objectName}`;
}
```

### 3. Document Upload with Metadata

```typescript
async function uploadDocument(
  documentId: string,
  fileBuffer: Buffer,
  metadata: {
    userId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }
): Promise<void> {
  const objectName = `${metadata.userId}/${documentId}`;

  await minioClient.putObject(
    'documents',
    objectName,
    fileBuffer,
    metadata.fileSize,
    {
      'Content-Type': metadata.mimeType,
      'X-Amz-Meta-User-Id': metadata.userId,
      'X-Amz-Meta-Original-Name': metadata.fileName,
      'X-Amz-Meta-Upload-Date': new Date().toISOString(),
    }
  );
}
```

### 4. Generate Temporary Access Link

```typescript
async function generateTemporaryLink(
  bucketName: string,
  objectName: string,
  expiryHours: number = 24
): Promise<string> {
  const expirySeconds = expiryHours * 60 * 60;
  return await minioClient.presignedGetObject(
    bucketName,
    objectName,
    expirySeconds
  );
}
```

### 5. Backup System

```typescript
async function backupDatabase(
  backupBuffer: Buffer,
  timestamp: Date
): Promise<void> {
  const fileName = `backup-${timestamp.toISOString()}.sql.gz`;

  await minioClient.putObject(
    'backups',
    fileName,
    backupBuffer,
    backupBuffer.length,
    { 'Content-Type': 'application/gzip' }
  );

  // Set up lifecycle rule to delete backups older than 30 days
  // (configure via MinIO Console or CLI)
}
```

## Troubleshooting

### Connection Issues
- Verify MINIO_ENDPOINT and MINIO_PORT are correct
- Check if using private network (use RAILWAY_PRIVATE_DOMAIN)
- Ensure MinIO service is running in Railway
- Verify credentials (MINIO_ROOT_USER, MINIO_ROOT_PASSWORD)

### Upload Failures
- Check file size limits
- Verify bucket exists
- Ensure sufficient storage quota
- Check network connectivity
- Validate credentials and permissions

### Access Denied Errors
- Verify bucket policies are correctly configured
- Check access key and secret key
- Ensure user has permission for the operation
- Verify bucket exists

### Performance Issues
- Use private networking for inter-service communication
- Implement multipart uploads for large files
- Consider implementing caching layer
- Check Railway resource limits

## Migration from AWS S3

MinIO is S3-compatible, making migration straightforward:

1. **Update endpoint**: Change from `s3.amazonaws.com` to MinIO endpoint
2. **Update credentials**: Use MinIO access keys
3. **Set forcePathStyle**: Add `forcePathStyle: true` for AWS SDK
4. **No code changes required**: S3 SDK commands work as-is

```typescript
// Before (AWS S3)
const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// After (MinIO)
const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER!,
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD!,
  },
  forcePathStyle: true, // Required for MinIO
});
```

## Resources

- MinIO Client SDK: https://www.npmjs.com/package/minio
- AWS SDK S3: https://www.npmjs.com/package/@aws-sdk/client-s3
- MinIO Documentation: https://min.io/docs/minio/linux/index.html
- Railway MinIO Template: https://railway.app/template/SMKOEA
- MinIO Console: Access via Railway public URL

## Notes
- MinIO requires persistent volumes - Railway handles this automatically
- Use HTTP (not HTTPS) for private network connections
- MinIO Console is accessible via public URL for admin operations
- Consider using CDN for public-facing assets
- Implement proper error handling and retry logic for production use
