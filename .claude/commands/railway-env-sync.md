# Sync Railway Environment

Sync environment variables from Railway to local development environment for testing and debugging.

## Tasks

1. **Environment Selection**
   - Show available Railway environments
   - Confirm which environment to sync
   - Warn if syncing production secrets locally

2. **Retrieve Variables**
   - Fetch all environment variables from selected environment
   - Parse and format variables
   - Identify sensitive variables (API keys, secrets)

3. **Generate Local Environment File**
   - Create .env.local file with Railway variables
   - Add warning comment about sensitive data
   - Preserve existing .env.local comments if any

4. **Security Verification**
   - Ensure .env.local is in .gitignore
   - Add .env.local to .gitignore if missing
   - Warn about not committing secrets

5. **Summary**
   - List synced variables (hide values of secrets)
   - Show file location
   - Provide usage instructions with `railway run`
   - Suggest using `railway shell` as alternative

## Expected Output

- Path to generated .env.local file
- Count of synced variables
- Security warnings about secret handling
- Instructions for using synced environment
