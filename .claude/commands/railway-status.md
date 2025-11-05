# Railway Status Check

Check the status of all Railway services, databases, and deployments in the current project.

## Tasks

1. **Project Overview**
   - Display current project information
   - Show active environment
   - List all services in the project

2. **Service Health**
   - Check status of each service
   - Display deployment status (active, failed, building)
   - Show resource usage (if available)
   - Display service URLs

3. **Database Status**
   - Check Postgres database status
   - Show connection string availability
   - Display database size (if accessible)
   - Check Redis/other databases if present

4. **Recent Deployments**
   - Show recent deployment history
   - Display last deployment status
   - Show any failed deployments with error messages

5. **Environment Variables**
   - Verify critical environment variables are set
   - Check for missing required variables
   - Validate reference variable syntax

6. **Private Networking**
   - Verify private networking configuration
   - Check inter-service connections
   - Display private domain information

## Expected Output

- Comprehensive status of all services
- Health indicators for each component
- Any issues or warnings detected
- Suggestions for resolving issues
- Quick access commands for common operations
