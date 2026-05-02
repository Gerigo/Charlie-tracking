/**
 * Quick check: what format are startTime/endTime in migrated events?
 * Usage: node scripts/check-events.mjs 'password'
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyDXOKB3GCmKq_Y4NR-1PaMPqYbSP0aWU_M',
  authDomain: 'sleeptracker-71e30.firebaseapp.com',
  projectId: 'sleeptracker-71e30',
});
const auth = getAuth(app);
const db = getFirestore(app);

const password = process.argv[2];
if (!password) { console.error('Usage: node scripts/check-events.mjs <password>'); process.exit(1); }

async function main() {
  const cred = await signInWithEmailAndPassword(auth, 'admin@charlie.com', password);

  // Check a legacy event
  const legacyQ = query(collection(db, 'events'), where('trackerId', '==', 'charlie-shared'), limit(3));
  const legacySnap = await getDocs(legacyQ);
  console.log('=== LEGACY EVENTS (original) ===');
  legacySnap.docs.forEach(d => {
    const data = d.data();
    console.log('ID:', d.id);
    console.log('  startTime:', data.startTime, '| type:', typeof data.startTime);
    console.log('  endTime:', data.endTime, '| type:', typeof data.endTime);
    console.log('  type:', data.type);
    if (data.startTime && typeof data.startTime === 'object') {
      console.log('  startTime.seconds:', data.startTime.seconds);
      console.log('  startTime.toMillis():', data.startTime.toMillis?.());
    }
    console.log('');
  });

  // Check a migrated event
  const familyId = 'eyQfL7aX3hhqbU2zAcac';
  const migratedQ = query(collection(db, 'events'), where('familyId', '==', familyId), limit(3));
  const migratedSnap = await getDocs(migratedQ);
  console.log('=== MIGRATED EVENTS (new schema) ===');
  migratedSnap.docs.forEach(d => {
    const data = d.data();
    console.log('ID:', d.id);
    console.log('  startTime:', data.startTime, '| type:', typeof data.startTime);
    console.log('  endTime:', data.endTime, '| type:', typeof data.endTime);
    console.log('  type:', data.type);
    console.log('  _migratedFrom:', data._migratedFrom);
    if (data.startTime && typeof data.startTime === 'object') {
      console.log('  startTime.seconds:', data.startTime.seconds);
      console.log('  startTime.toMillis():', data.startTime.toMillis?.());
    }
    console.log('');
  });

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
