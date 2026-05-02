import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyDXOKB3GCmKq_Y4NR-1PaMPqYbSP0aWU_M',
  authDomain: 'sleeptracker-71e30.firebaseapp.com',
  projectId: 'sleeptracker-71e30',
});
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  await signInWithEmailAndPassword(auth, 'admin@charlie.com', process.argv[2]);
  const familyId = 'eyQfL7aX3hhqbU2zAcac';

  const legacyQ = query(collection(db, 'events'), where('trackerId', '==', 'charlie-shared'));
  const migratedQ = query(collection(db, 'events'), where('familyId', '==', familyId));

  const [legacySnap, migratedSnap] = await Promise.all([getDocs(legacyQ), getDocs(migratedQ)]);

  console.log('Legacy events:', legacySnap.size);
  console.log('Migrated events:', migratedSnap.size);

  // Count by type
  const legacyByType = {};
  legacySnap.docs.forEach(d => { const t = d.data().type; legacyByType[t] = (legacyByType[t] || 0) + 1; });
  const migratedByType = {};
  migratedSnap.docs.forEach(d => { const t = d.data().type; migratedByType[t] = (migratedByType[t] || 0) + 1; });

  console.log('\nLegacy by type:', JSON.stringify(legacyByType));
  console.log('Migrated by type:', JSON.stringify(migratedByType));

  // Check specific date: April 7
  const april7Start = new Date('2026-04-07T00:00:00').getTime();
  const april7End = new Date('2026-04-08T00:00:00').getTime();

  const legacyApril7 = legacySnap.docs.filter(d => {
    const st = d.data().startTime;
    return typeof st === 'number' && st >= april7Start && st < april7End;
  });
  const migratedApril7 = migratedSnap.docs.filter(d => {
    const st = d.data().startTime;
    return typeof st === 'number' && st >= april7Start && st < april7End;
  });

  console.log('\n=== April 7 ===');
  console.log('Legacy:', legacyApril7.length, 'events');
  console.log('Migrated:', migratedApril7.length, 'events');

  // Detail sleep events on April 7
  console.log('\nLegacy sleep April 7:');
  legacyApril7.filter(d => d.data().type === 'sleep').forEach(d => {
    const data = d.data();
    const duration = data.endTime ? Math.round((data.endTime - data.startTime) / 60000) : 'ongoing';
    console.log(`  ${new Date(data.startTime).toISOString()} → ${data.endTime ? new Date(data.endTime).toISOString() : 'null'} (${duration} min)`);
  });

  console.log('\nMigrated sleep April 7:');
  migratedApril7.filter(d => d.data().type === 'sleep').forEach(d => {
    const data = d.data();
    const duration = data.endTime && typeof data.endTime === 'number' ? Math.round((data.endTime - data.startTime) / 60000) : 'no endTime';
    console.log(`  ${new Date(data.startTime).toISOString()} → ${data.endTime && typeof data.endTime === 'number' ? new Date(data.endTime).toISOString() : 'null'} (${duration})`);
  });

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
