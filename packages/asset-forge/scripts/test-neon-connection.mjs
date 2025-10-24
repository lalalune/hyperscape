/**
 * Test Neon Database Connection
 * 
 * Verifies that the Neon PostgreSQL database is connected and accessible
 */

import { testConnection, sql } from '../server/db/index-neon.mjs'

async function main() {
  console.log('🔍 Testing Neon Database Connection...\n')

  try {
    // Test basic connection
    await testConnection()
    console.log('✅ Connection test passed\n')

    // List tables
    console.log('📊 Querying tables...')
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    
    console.log('✅ Available tables:')
    result.forEach(row => console.log(`   - ${row.table_name}`))
    
    console.log('\n🎉 Neon database is ready!')
    console.log('\nConnection details:')
    console.log('- Project: asset-forge')
    console.log('- Project ID: spring-darkness-74772296')
    console.log('- Database: neondb')
    console.log('- Tables: 9')
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Connection test failed:', error.message)
    console.error('\nMake sure DATABASE_URL is set in your .env file')
    process.exit(1)
  }
}

main()

