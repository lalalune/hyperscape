# Railway Database Backup

Create a backup of the Railway Postgres database and optionally upload it to MinIO storage.

## Tasks

1. **Pre-Backup Checks**
   - Verify Railway authentication
   - Check if Postgres service exists
   - Confirm DATABASE_URL is available
   - Check for MinIO configuration (if uploading backup)

2. **Create Backup**
   - Generate backup filename with timestamp
   - Use pg_dump to create database backup
   - Compress backup file (gzip)
   - Verify backup file was created successfully

3. **Upload to Storage (Optional)**
   - If MinIO is configured, upload backup
   - Store in 'backups' bucket with appropriate metadata
   - Generate backup record with timestamp and size

4. **Cleanup**
   - Optionally clean up local backup file
   - List recent backups
   - Suggest backup retention policy

5. **Summary**
   - Display backup file location
   - Show backup size
   - Provide restore instructions
   - Suggest automated backup schedule

## Expected Output

- Backup file path (local or MinIO)
- Backup size and timestamp
- Restore command for reference
- Suggestions for backup automation
