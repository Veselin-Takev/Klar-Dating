import { readFile } from 'node:fs/promises';

const files = ['scripts/backup-firestore.sh', 'scripts/restore-firestore.sh'];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  if (!text.includes('set -euo pipefail')) throw new Error(`${file}: missing fail-fast shell policy`);
  if (/gcloud firestore (export|import).*--async/.test(text)) throw new Error(`${file}: asynchronous Firestore operation is not allowed; completion must be observable before success`);
}
const backup = await readFile('scripts/backup-firestore.sh', 'utf8');
const restore = await readFile('scripts/restore-firestore.sh', 'utf8');
if (!backup.includes('Backup export completed:')) throw new Error('backup script: missing completed-export confirmation');
if (!restore.includes('Restore completed.')) throw new Error('restore script: missing completed-restore confirmation');
if (!restore.includes('KLAR_BACKUP_BUCKET')) throw new Error('restore script: approved backup bucket binding is required');
if (!restore.includes('expected_prefix=\"${KLAR_BACKUP_BUCKET}/firestore/${KLAR_PROJECT_ID}/\"')) throw new Error('restore script: project-scoped backup prefix binding is required');
console.log('Recovery scripts: synchronous export/import and fail-closed completion semantics PASS');
