/**
 * Migration script: copies all collections from "test" → "moneydocs"
 * Run with: node scripts/migrate-test-to-moneydocs.mjs
 */

import { MongoClient } from "mongodb";
import dns from "node:dns";

// Same DNS fix used in the app
try {
  dns.setDefaultResultOrder?.("ipv4first");
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {}

// Build URIs for both databases from the same cluster credentials
const BASE_URI =
  "mongodb://Vercel-Admin-dclnedocs:kj3x5mxp7jzHJ6WP@ac-ml0lqls-shard-00-00.twqvkoa.mongodb.net:27017,ac-ml0lqls-shard-00-01.twqvkoa.mongodb.net:27017,ac-ml0lqls-shard-00-02.twqvkoa.mongodb.net:27017";
const OPTS = "ssl=true&replicaSet=atlas-xtm21f-shard-0&authSource=admin&retryWrites=true&w=majority";

const SOURCE_URI = `${BASE_URI}/test?${OPTS}`;
const TARGET_URI = `${BASE_URI}/moneydocs?${OPTS}`;

async function migrate() {
  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  try {
    console.log("🔌 Connecting to source (test) and target (moneydocs)...");
    await Promise.all([sourceClient.connect(), targetClient.connect()]);

    const sourceDb = sourceClient.db("test");
    const targetDb = targetClient.db("moneydocs");

    // List all collections in source
    const collections = await sourceDb.listCollections().toArray();

    if (collections.length === 0) {
      console.log("⚠️  No collections found in 'test' database. Nothing to migrate.");
      return;
    }

    console.log(`\n📦 Found ${collections.length} collection(s): ${collections.map((c) => c.name).join(", ")}\n`);

    for (const colInfo of collections) {
      const colName = colInfo.name;
      const sourceCol = sourceDb.collection(colName);
      const targetCol = targetDb.collection(colName);

      const totalDocs = await sourceCol.countDocuments();

      if (totalDocs === 0) {
        console.log(`  ⏭️  ${colName}: empty, skipping.`);
        continue;
      }

      console.log(`  ➡️  Migrating '${colName}' (${totalDocs} document(s))...`);

      // Copy all documents in batches of 500
      const BATCH = 500;
      let inserted = 0;
      const cursor = sourceCol.find();

      let batch = [];
      for await (const doc of cursor) {
        batch.push(doc);
        if (batch.length === BATCH) {
          await targetCol.insertMany(batch, { ordered: false }).catch((e) => {
            // Ignore duplicate key errors (already migrated docs)
            if (e.code !== 11000) throw e;
          });
          inserted += batch.length;
          batch = [];
          process.stdout.write(`     ${inserted}/${totalDocs} copied...\r`);
        }
      }

      // Insert remaining
      if (batch.length > 0) {
        await targetCol.insertMany(batch, { ordered: false }).catch((e) => {
          if (e.code !== 11000) throw e;
        });
        inserted += batch.length;
      }

      // Copy indexes (skip _id_ which is created automatically)
      const indexes = await sourceCol.listIndexes().toArray();
      for (const idx of indexes) {
        if (idx.name === "_id_") continue;
        const { key, name, ...opts } = idx;
        try {
          await targetCol.createIndex(key, { name, ...opts });
        } catch {
          // Index may already exist — safe to ignore
        }
      }

      console.log(`  ✅  ${colName}: ${inserted} document(s) copied + indexes recreated.`);
    }

    console.log("\n🎉 Migration complete! All data is now in 'moneydocs'.");
    console.log("   You can verify in MongoDB Atlas, then drop the old 'test' database when ready.\n");
  } catch (err) {
    console.error("\n❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await Promise.all([sourceClient.close(), targetClient.close()]);
  }
}

migrate();
