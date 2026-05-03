/**
 * Adds the admin user as a member of the family.
 * Required for the Settings screen to show the user-photo edit button
 * (the UI is conditional on family.members.find(m => m.uid === currentUid)).
 *
 * Usage: node scripts/patch-family-members.mjs <password>
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

const ADMIN_EMAIL = 'admin@charlie.com';
const FAMILY_ID = 'osWgSUAkUsuNv4SNrQzI';

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
  console.error('Usage: node scripts/patch-family-members.mjs <password>');
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

  const familyRef = doc(db, 'families', FAMILY_ID);
  const snap = await getDoc(familyRef);
  if (!snap.exists()) throw new Error(`Family ${FAMILY_ID} does not exist`);

  const family = snap.data();
  const existingMembers = Array.isArray(family.members) ? family.members : [];

  if (existingMembers.some((m) => m.uid === uid)) {
    console.log('ℹ️  User already in family.members — nothing to do');
    process.exit(0);
  }

  const displayName =
    cred.user.displayName ||
    family.parentNames?.[0] ||
    cred.user.email?.split('@')[0] ||
    'Parent';

  const newMember = {
    uid,
    displayName,
    role: 'manager',
    parentLabel: 'Papa',
  };

  console.log('\n👥 Adding member to family');
  console.log('   ', JSON.stringify(newMember));

  await updateDoc(familyRef, {
    members: [...existingMembers, newMember],
    managerIds: Array.from(new Set([...(family.managerIds ?? []), uid])),
    updatedAt: Date.now(),
  });

  console.log('\n✅ Family.members patched');
  console.log('   Admin photo upload button should now appear in Settings');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Patch failed:', err.message);
  process.exit(1);
});
