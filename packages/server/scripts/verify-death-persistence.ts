/**
 * Death System Database Persistence Verification Script
 *
 * This script verifies that the death lock database persistence is working correctly.
 *
 * Tests:
 * 1. Database table exists
 * 2. Can save death lock
 * 3. Can retrieve death lock
 * 4. Can update death lock
 * 5. Can delete death lock
 *
 * Run with: npx tsx packages/server/scripts/verify-death-persistence.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as dotenv from "dotenv";
import * as schema from "../src/database/schema.js";
import { eq } from "drizzle-orm";

// Load environment variables
dotenv.config({ path: ".env" });

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "postgresql://hyperscape:hyperscape@localhost:5432/hyperscape";

async function main() {
  console.log("\n🧪 Death System Database Persistence Verification\n");
  console.log("=".repeat(60));

  // Connect to database
  console.log("\n1️⃣  Connecting to database...");
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });
  console.log("✅ Connected to:", DATABASE_URL.replace(/:[^:@]+@/, ":****@"));

  try {
    // Test 1: Check if player_deaths table exists
    console.log("\n2️⃣  Checking if player_deaths table exists...");
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'player_deaths'
      ) as exists;
    `);

    if (!tableCheck.rows[0].exists) {
      console.log("❌ Table 'player_deaths' does not exist!");
      console.log("\n💡 Run: npx drizzle-kit push");
      await pool.end();
      process.exit(1);
    }
    console.log("✅ Table 'player_deaths' exists");

    // Test 2: Create a test character first (required by foreign key)
    console.log("\n3️⃣  Creating test character...");
    const testAccountId = "test_account_" + Date.now();
    const testPlayerId = "test_player_" + Date.now();

    await db.insert(schema.characters).values({
      id: testPlayerId,
      accountId: testAccountId,
      name: "Test Player",
      createdAt: Date.now(),
    });
    console.log("✅ Test character created:", testPlayerId);

    // Test 3: Insert a test death lock
    console.log("\n4️⃣  Testing insert death lock...");
    const testData = {
      playerId: testPlayerId,
      gravestoneId: "gravestone_test_123",
      groundItemIds: JSON.stringify(["item1", "item2", "item3"]),
      position: JSON.stringify({ x: 100, y: 50, z: 200 }),
      timestamp: Date.now(),
      zoneType: "safe_area",
      itemCount: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.insert(schema.playerDeaths).values(testData);
    console.log("✅ Successfully inserted death lock for:", testPlayerId);

    // Test 4: Retrieve the death lock
    console.log("\n5️⃣  Testing retrieve death lock...");
    const retrieved = await db
      .select()
      .from(schema.playerDeaths)
      .where(eq(schema.playerDeaths.playerId, testPlayerId))
      .limit(1);

    if (retrieved.length === 0) {
      console.log("❌ Failed to retrieve death lock!");
      await pool.end();
      process.exit(1);
    }

    console.log("✅ Successfully retrieved death lock:");
    console.log("   Player ID:", retrieved[0].playerId);
    console.log("   Gravestone ID:", retrieved[0].gravestoneId);
    console.log("   Ground Items:", retrieved[0].groundItemIds);
    console.log("   Position:", retrieved[0].position);
    console.log("   Zone Type:", retrieved[0].zoneType);
    console.log("   Item Count:", retrieved[0].itemCount);

    // Test 5: Update the death lock (gravestone expired)
    console.log(
      "\n6️⃣  Testing update death lock (gravestone → ground items)...",
    );
    await db
      .update(schema.playerDeaths)
      .set({
        gravestoneId: null,
        groundItemIds: JSON.stringify(["ground1", "ground2"]),
        itemCount: 2,
        updatedAt: Date.now(),
      })
      .where(eq(schema.playerDeaths.playerId, testPlayerId));

    const updated = await db
      .select()
      .from(schema.playerDeaths)
      .where(eq(schema.playerDeaths.playerId, testPlayerId))
      .limit(1);

    if (updated[0].gravestoneId !== null) {
      console.log("❌ Failed to update gravestone ID to null!");
      await pool.end();
      process.exit(1);
    }

    console.log("✅ Successfully updated death lock:");
    console.log(
      "   Gravestone ID:",
      updated[0].gravestoneId,
      "(null = expired)",
    );
    console.log("   Ground Items:", updated[0].groundItemIds);
    console.log("   Item Count:", updated[0].itemCount);

    // Test 6: Delete the death lock
    console.log("\n7️⃣  Testing delete death lock...");
    await db
      .delete(schema.playerDeaths)
      .where(eq(schema.playerDeaths.playerId, testPlayerId));

    const deleted = await db
      .select()
      .from(schema.playerDeaths)
      .where(eq(schema.playerDeaths.playerId, testPlayerId))
      .limit(1);

    if (deleted.length > 0) {
      console.log("❌ Failed to delete death lock!");
      await pool.end();
      process.exit(1);
    }

    console.log("✅ Successfully deleted death lock");

    // Test 7: Clean up test character
    console.log("\n8️⃣  Cleaning up test data...");
    await db
      .delete(schema.characters)
      .where(eq(schema.characters.id, testPlayerId));
    console.log("✅ Test character deleted");

    // Test 8: Check indexes
    console.log("\n9️⃣  Checking database indexes...");
    const indexCheck = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'player_deaths';
    `);

    console.log("✅ Found", indexCheck.rows.length, "indexes:");
    for (const index of indexCheck.rows) {
      console.log("   -", index.indexname);
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS PASSED!");
    console.log("\n📊 Summary:");
    console.log("   ✓ Table exists");
    console.log("   ✓ Can insert death locks");
    console.log("   ✓ Can retrieve death locks");
    console.log("   ✓ Can update death locks");
    console.log("   ✓ Can delete death locks");
    console.log("   ✓ Indexes are created");
    console.log("\n🎉 Death system database persistence is WORKING!\n");
  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    await pool.end();
    process.exit(1);
  }

  await pool.end();
}

main();
