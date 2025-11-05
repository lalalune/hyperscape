Create encrypted database backup with retention policy.

## Instructions

```bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

echo "💾 Creating database backup..."

# PostgreSQL
if command -v pg_dump &> /dev/null; then
  DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2-)
  pg_dump "$DB_URL" | gzip > "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

  # Encrypt
  openssl enc -aes-256-cbc -salt -in "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz" \
    -out "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz.enc" -k "$(openssl rand -base64 32)"

  rm "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
  echo "✅ Backup created: backup_$TIMESTAMP.sql.gz.enc"
fi

# MongoDB
if command -v mongodump &> /dev/null; then
  mongodump --out "$BACKUP_DIR/mongo_$TIMESTAMP"
  tar -czf "$BACKUP_DIR/mongo_$TIMESTAMP.tar.gz" "$BACKUP_DIR/mongo_$TIMESTAMP"
  rm -rf "$BACKUP_DIR/mongo_$TIMESTAMP"
  echo "✅ MongoDB backup created"
fi

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "backup_*.enc" -mtime +7 -delete
echo "✅ Cleaned up old backups"

echo ""
echo "Backup location: $BACKUP_DIR"
echo "Upload to S3: aws s3 cp $BACKUP_DIR/backup_$TIMESTAMP.sql.gz.enc s3://backups/"
```
