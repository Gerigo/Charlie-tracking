/**
 * Migration script: Legacy → New schema
 *
 * What it does:
 * 1. Signs in as admin@charlie.com
 * 2. Creates a real family, baby, membership in Firestore
 * 3. Duplicates all legacy events (trackerId: 'charlie-shared') into new-schema events
 *    with familyId + babyId + createdByUserId fields
 * 4. Updates the userProfile with defaultFamilyId + defaultBabyId
 *
 * The original legacy documents are NOT modified — the web app continues to work.
 *
 * Usage: node scripts/migrate-legacy.mjs <password>
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

const ADMIN_EMAIL = 'admin@charlie.com';
const LEGACY_TRACKER_ID = 'charlie-shared';
const BABY_FIRST_NAME = 'Charlie';
const BABY_BIRTH_DATE = '2026-03-03T12:00:00.000Z';
const BABY_SEX = 'boy';
const BABY_FEEDING_MODE = 'breastfeeding';

import { firebaseConfig } from './_firebase.mjs';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/migrate-legacy.mjs <password>');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Secure invite code generator ---
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateInviteCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

async function migrate() {
  console.log('🔑 Signing in as', ADMIN_EMAIL);
  const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  const uid = cred.user.uid;
  console.log('✅ Signed in. UID:', uid);

  // 1. Read all legacy events
  console.log('\n📖 Reading legacy events (trackerId:', LEGACY_TRACKER_ID, ')...');
  const sharedQ = query(collection(db, 'events'), where('trackerId', '==', LEGACY_TRACKER_ID));
  const userQ = query(collection(db, 'events'), where('userId', '==', uid));

  const [sharedSnap, userSnap] = await Promise.all([getDocs(sharedQ), getDocs(userQ)]);

  // Merge by ID (shared takes priority)
  const eventMap = new Map();
  userSnap.docs.forEach((d) => eventMap.set(d.id, d.data()));
  sharedSnap.docs.forEach((d) => eventMap.set(d.id, d.data()));

  console.log(`  Found ${eventMap.size} unique legacy events (${sharedSnap.size} shared + ${userSnap.size} user)`);

  // 2. Create family + baby + membership
  const ts = Date.now();
  const familyRef = doc(collection(db, 'families'));
  const babyRef = doc(collection(db, 'babies'));
  const membershipId = `${familyRef.id}_${uid}`;
  const inviteCode = generateInviteCode();
  const familyName = 'Famille Charlie';

  console.log('\n🏠 Creating family:', familyRef.id);
  console.log('👶 Creating baby:', babyRef.id);
  console.log('👤 Creating membership:', membershipId);
  console.log('🔗 Invite code:', inviteCode);

  // Create core documents
  await setDoc(familyRef, {
    name: familyName,
    ownerUserId: uid,
    inviteCode,
    parentNames: [cred.user.displayName || 'Parent'],
    visitTypes: [],
    premiumStatus: 'free',
    createdAt: ts,
    updatedAt: ts,
  });

  await setDoc(babyRef, {
    familyId: familyRef.id,
    firstName: BABY_FIRST_NAME,
    birthDate: BABY_BIRTH_DATE,
    sex: BABY_SEX,
    feedingMode: BABY_FEEDING_MODE,
    avatarKey: 'babyAvatar',
    createdAt: ts,
    updatedAt: ts,
  });

  await setDoc(doc(db, 'memberships', membershipId), {
    familyId: familyRef.id,
    userId: uid,
    role: 'owner',
    displayName: cred.user.displayName || 'Parent',
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  });

  // Create invite code lookup
  await setDoc(doc(db, 'inviteCodes', inviteCode), {
    familyId: familyRef.id,
    familyName,
    createdAt: ts,
  });

  // Update user profile
  await setDoc(doc(db, 'userProfiles', uid), {
    defaultFamilyId: familyRef.id,
    defaultBabyId: babyRef.id,
    updatedAt: ts,
  }, { merge: true });

  console.log('✅ Core documents created');

  // 3. Duplicate legacy events with new schema fields
  console.log('\n📋 Duplicating legacy events into new schema...');
  const entries = [...eventMap.entries()];
  let migrated = 0;
  let skipped = 0;

  // Firestore batches can hold max 500 operations
  const BATCH_SIZE = 400;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const [originalId, data] of chunk) {
      // Skip events that already have familyId (already migrated)
      if (data.familyId) {
        skipped++;
        continue;
      }

      // Create a new document with the new schema fields
      const newRef = doc(collection(db, 'events'));

      const newEvent = {
        // Copy all original fields
        ...data,
        // Add new schema fields
        familyId: familyRef.id,
        babyId: babyRef.id,
        createdByUserId: data.userId || uid,
        createdByRole: 'owner',
        // Keep original times
        startTime: data.startTime ?? ts,
        endTime: data.endTime ?? null,
        // Metadata
        createdAt: data.createdAt ?? data.startTime ?? ts,
        updatedAt: data.updatedAt ?? data.startTime ?? ts,
        serverCreatedAt: serverTimestamp(),
        // Migration marker
        _migratedFrom: originalId,
      };

      // Remove legacy-only fields from the new doc
      delete newEvent.trackerId;
      delete newEvent.userId;

      batch.set(newRef, newEvent);
      migrated++;
    }

    await batch.commit();
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} processed`);
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   ${migrated} events duplicated into new schema`);
  console.log(`   ${skipped} events skipped (already had familyId)`);
  console.log(`   Family ID: ${familyRef.id}`);
  console.log(`   Baby ID: ${babyRef.id}`);
  console.log(`   Invite code: ${inviteCode}`);
  console.log(`\n💡 Original legacy events are untouched — web app continues to work.`);

  // Also migrate active session if it exists
  try {
    const sessionQ = query(collection(db, 'activeSessions'), where('trackerId', '==', LEGACY_TRACKER_ID));
    const sessionSnap = await getDocs(sessionQ);
    if (!sessionSnap.empty) {
      const sessionData = sessionSnap.docs[0].data();
      await setDoc(doc(db, 'activeSessions', babyRef.id), {
        familyId: familyRef.id,
        babyId: babyRef.id,
        eventId: sessionData.eventId || '',
        type: 'sleep',
        startTime: sessionData.startTime ?? ts,
        details: sessionData.details ?? {},
        createdByUserId: uid,
        createdByRole: 'owner',
        updatedAt: ts,
      });
      console.log('   Active sleep session migrated');
    }
  } catch (e) {
    console.log('   No active session to migrate (or error):', e.message);
  }

  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
