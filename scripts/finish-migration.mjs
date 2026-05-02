/**
 * Finish migration after migrate-legacy.mjs partial failure.
 *
 * Reuses already-created family/baby, skips memberships (dead in V2),
 * creates invite code with required `type: 'manager'`, updates userProfile,
 * and migrates legacy events.
 *
 * Usage: node scripts/finish-migration.mjs <password>
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

const ADMIN_EMAIL = 'admin@charlie.com';
const LEGACY_TRACKER_ID = 'charlie-shared';

// IDs already created during the failed run
const FAMILY_ID = 'VWSC9YSaNGRsckkkBS2i';
const BABY_ID = '9t44nmNJUZTknZxL0PfX';
const FAMILY_NAME = 'Famille Charlie';

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
  console.error('Usage: node scripts/finish-migration.mjs <password>');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateInviteCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

async function findFreeInviteCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateInviteCode();
    const snap = await getDoc(doc(db, 'inviteCodes', candidate));
    if (!snap.exists()) return candidate;
  }
  throw new Error('Could not find a free invite code after 8 attempts');
}

async function main() {
  console.log('🔑 Signing in as', ADMIN_EMAIL);
  const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  const uid = cred.user.uid;
  console.log('✅ Signed in. UID:', uid);

  // Sanity-check the family/baby exist (created in prior run)
  const familySnap = await getDoc(doc(db, 'families', FAMILY_ID));
  const babySnap = await getDoc(doc(db, 'babies', BABY_ID));
  if (!familySnap.exists()) throw new Error(`Family ${FAMILY_ID} does not exist`);
  if (!babySnap.exists()) throw new Error(`Baby ${BABY_ID} does not exist`);
  console.log('✅ Found existing family + baby');

  const ts = Date.now();

  // 1. Create invite code with required `type: 'manager'`
  const inviteCode = await findFreeInviteCode();
  console.log('\n🔗 Creating invite code:', inviteCode);
  await setDoc(doc(db, 'inviteCodes', inviteCode), {
    familyId: FAMILY_ID,
    familyName: FAMILY_NAME,
    type: 'manager',
    createdAt: ts,
  });
  console.log('✅ Invite code created');

  // 2. Update user profile
  console.log('\n👤 Updating user profile');
  await setDoc(
    doc(db, 'userProfiles', uid),
    {
      defaultFamilyId: FAMILY_ID,
      defaultBabyId: BABY_ID,
      updatedAt: ts,
    },
    { merge: true }
  );
  console.log('✅ User profile updated');

  // 3. Read legacy events
  console.log('\n📖 Reading legacy events (trackerId:', LEGACY_TRACKER_ID, ')...');
  const sharedQ = query(collection(db, 'events'), where('trackerId', '==', LEGACY_TRACKER_ID));
  const userQ = query(collection(db, 'events'), where('userId', '==', uid));
  const [sharedSnap, userSnap] = await Promise.all([getDocs(sharedQ), getDocs(userQ)]);

  const eventMap = new Map();
  userSnap.docs.forEach((d) => eventMap.set(d.id, d.data()));
  sharedSnap.docs.forEach((d) => eventMap.set(d.id, d.data()));
  console.log(`  Found ${eventMap.size} unique legacy events (${sharedSnap.size} shared + ${userSnap.size} user)`);

  // 4. Duplicate legacy events with new schema fields
  console.log('\n📋 Duplicating legacy events into new schema...');
  const entries = [...eventMap.entries()];
  let migrated = 0;
  let skipped = 0;

  const BATCH_SIZE = 400;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const [originalId, data] of chunk) {
      if (data.familyId) {
        skipped++;
        continue;
      }
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
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} processed`);
  }

  console.log('\n✅ Migration complete!');
  console.log(`   ${migrated} events duplicated into new schema`);
  console.log(`   ${skipped} events skipped (already had familyId)`);
  console.log(`   Family ID:   ${FAMILY_ID}`);
  console.log(`   Baby ID:     ${BABY_ID}`);
  console.log(`   Invite code: ${inviteCode}`);

  // 5. Active session migration (optional)
  try {
    const sessionQ = query(collection(db, 'activeSessions'), where('trackerId', '==', LEGACY_TRACKER_ID));
    const sessionSnap = await getDocs(sessionQ);
    if (!sessionSnap.empty) {
      const sessionData = sessionSnap.docs[0].data();
      await setDoc(doc(db, 'activeSessions', BABY_ID), {
        familyId: FAMILY_ID,
        babyId: BABY_ID,
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

main().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
