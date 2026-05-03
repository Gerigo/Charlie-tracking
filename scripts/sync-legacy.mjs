/**
 * Incremental sync — only events added to the legacy schema since the
 * last full migration get duplicated into the V2 family.
 *
 * How it stays idempotent:
 *   1. Read every V2 event for this family. Each was tagged with
 *      `_migratedFrom: <legacyId>` by the previous script(s) — that's
 *      our "already done" set.
 *   2. Read every legacy event (trackerId === 'charlie-shared' OR
 *      userId === admin.uid).
 *   3. For each legacy event whose ID is NOT in the already-done set,
 *      create a V2 copy.
 *
 * Safe to run as many times as you want. Re-runs report 0 new and a
 * count of already-migrated events that were skipped.
 *
 * Usage: node scripts/sync-legacy.mjs '<admin-password>'
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

const ADMIN_EMAIL = 'admin@charlie.com';
const LEGACY_TRACKER_ID = 'charlie-shared';

// V2 family + baby created by migrate-legacy.mjs / finish-migration.mjs
// (run on 2026-05-03). Update if you ever start over from scratch.
const FAMILY_ID = 'osWgSUAkUsuNv4SNrQzI';
const BABY_ID = 'yZBl10Ybdph9ooGbguoe';

const firebaseConfig = {
  apiKey: 'AIzaSyDXOKB3GCmKq_Y4NR-1PaMPqYbSP0aWU_M',
  authDomain: 'sleeptracker-71e30.firebaseapp.com',
  projectId: 'sleeptracker-71e30',
  storageBucket: 'sleeptracker-71e30.firebasestorage.app',
  messagingSenderId: '621914073040',
  appId: '1:621914073040:web:37a4fa561275e9137abbd5',
};

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/sync-legacy.mjs <password>');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  console.log('🔑 Signing in as', ADMIN_EMAIL);
  const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  const uid = cred.user.uid;
  console.log('✅ Signed in. UID:', uid);

  // ── 1. Build the "already migrated" set from existing V2 events ──
  console.log('\n📋 Reading existing V2 events for family', FAMILY_ID);
  const v2Q = query(collection(db, 'events'), where('familyId', '==', FAMILY_ID));
  const v2Snap = await getDocs(v2Q);
  const alreadyMigrated = new Set();
  for (const d of v2Snap.docs) {
    const src = d.data()._migratedFrom;
    if (typeof src === 'string') alreadyMigrated.add(src);
  }
  console.log(`  Found ${v2Snap.size} V2 events, ${alreadyMigrated.size} traceable to a legacy doc`);

  // ── 2. Read every legacy event (shared tracker + my user) ──
  console.log('\n📖 Reading legacy events');
  const sharedQ = query(collection(db, 'events'), where('trackerId', '==', LEGACY_TRACKER_ID));
  const userQ = query(collection(db, 'events'), where('userId', '==', uid));
  const [sharedSnap, userSnap] = await Promise.all([getDocs(sharedQ), getDocs(userQ)]);

  // Merge by document ID (a single event can match both queries)
  const legacy = new Map();
  userSnap.docs.forEach((d) => legacy.set(d.id, d.data()));
  sharedSnap.docs.forEach((d) => legacy.set(d.id, d.data()));
  console.log(`  ${legacy.size} unique legacy events (${sharedSnap.size} shared + ${userSnap.size} user)`);

  // ── 3. Filter to deltas and write in batches ──
  const deltas = [...legacy.entries()].filter(([id]) => !alreadyMigrated.has(id));
  console.log(`\n🆕 ${deltas.length} legacy events not yet migrated`);
  if (deltas.length === 0) {
    console.log('✅ Nothing to do — V2 is in sync with legacy.');
    process.exit(0);
  }

  console.log('\n📋 Duplicating delta events into V2 schema...');
  const ts = Date.now();
  const BATCH_SIZE = 400;
  let migrated = 0;
  for (let i = 0; i < deltas.length; i += BATCH_SIZE) {
    const chunk = deltas.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const [originalId, data] of chunk) {
      const newRef = doc(collection(db, 'events'));
      const newEvent = {
        ...data,
        familyId: FAMILY_ID,
        babyId: BABY_ID,
        createdByUserId: data.userId || uid,
        createdByRole: 'owner',
        startTime: data.startTime ?? ts,
        endTime: data.endTime ?? null,
        createdAt: data.createdAt ?? data.startTime ?? ts,
        updatedAt: data.updatedAt ?? data.startTime ?? ts,
        serverCreatedAt: serverTimestamp(),
        _migratedFrom: originalId,
      };
      delete newEvent.trackerId;
      delete newEvent.userId;
      batch.set(newRef, newEvent);
      migrated++;
    }

    await batch.commit();
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} written`);
  }

  console.log('\n✅ Sync complete!');
  console.log(`   ${migrated} new events copied to V2`);
  console.log(`   ${alreadyMigrated.size} already-migrated events skipped`);
  console.log(`   Family: ${FAMILY_ID} · Baby: ${BABY_ID}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
