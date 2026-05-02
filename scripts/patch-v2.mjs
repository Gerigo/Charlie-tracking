/**
 * V2 schema patch for the family / userProfile created by finish-migration.
 *
 * - family.parentsCombination = 'papa_maman'
 * - family.parentNames = ['Papa', 'Maman']
 * - family.guestCode = <random> (future-proof, V2 guest mode)
 * - userProfiles.{uid}.familyId = FAMILY_ID (V2 canonical, defaultFamilyId stays as fallback)
 *
 * Usage: node scripts/patch-v2.mjs <password>
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

const ADMIN_EMAIL = 'admin@charlie.com';
const FAMILY_ID = 'VWSC9YSaNGRsckkkBS2i';
const PARENTS_COMBINATION = 'papa_maman';
const PARENT_NAMES = ['Papa', 'Maman'];

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
  console.error('Usage: node scripts/patch-v2.mjs <password>');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateGuestCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

async function main() {
  console.log('🔑 Signing in as', ADMIN_EMAIL);
  const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  const uid = cred.user.uid;
  console.log('✅ Signed in. UID:', uid);

  const familySnap = await getDoc(doc(db, 'families', FAMILY_ID));
  if (!familySnap.exists()) throw new Error(`Family ${FAMILY_ID} does not exist`);

  const guestCode = generateGuestCode();
  const ts = Date.now();

  console.log('\n👨‍👩 Patching family with V2 fields');
  console.log('   parentsCombination =', PARENTS_COMBINATION);
  console.log('   parentNames        =', PARENT_NAMES);
  console.log('   guestCode          =', guestCode);
  await updateDoc(doc(db, 'families', FAMILY_ID), {
    parentsCombination: PARENTS_COMBINATION,
    parentNames: PARENT_NAMES,
    guestCode,
    updatedAt: ts,
  });
  console.log('✅ Family patched');

  console.log('\n👤 Patching userProfile with V2 familyId');
  await setDoc(
    doc(db, 'userProfiles', uid),
    {
      familyId: FAMILY_ID,
      updatedAt: ts,
    },
    { merge: true }
  );
  console.log('✅ User profile patched');

  console.log('\n🎉 V2 patch complete.');
  console.log(`   Family ID:  ${FAMILY_ID}`);
  console.log(`   Guest code: ${guestCode}  (saved on family.guestCode)`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Patch failed:', err.message);
  process.exit(1);
});
