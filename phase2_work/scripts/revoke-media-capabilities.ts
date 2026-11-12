/** Reviewed operational migration. Default is read-only. Never print object
 * names, UIDs, tokens or provider responses. Execute only against an explicitly
 * selected project/bucket with authorized operator credentials. */
import { getServerFirebaseApp } from '../src/server/db';
import { getAppBucket } from '../src/server/storage';
import { revokeAccountMediaCapabilities } from '../src/server/mediaCapabilities';

async function main() {
const args = process.argv.slice(2);
const option = (name: string) => args.find(value => value.startsWith(name + '='))?.slice(name.length + 1);
const project = option('--project'), bucketName = option('--bucket'), apply = args.includes('--apply');
if (!project || !bucketName || args.some(value => !['--apply', `--project=${project}`, `--bucket=${bucketName}`].includes(value))) throw new Error('explicit_project_and_bucket_required');
const app = getServerFirebaseApp(), bucket = getAppBucket();
if (app.options.projectId !== project || bucket.name !== bucketName) throw new Error('media_migration_identity_mismatch');
let owners = 0, objects = 0, failures = 0;
const seen = new Set<string>();
for (const prefix of ['profiles/', 'verification/']) {
  let pageToken: string | undefined;
  do {
    const [files, next] = await bucket.getFiles({prefix,maxResults:100,autoPaginate:false,...(pageToken?{pageToken}:{})});
    for (const file of files) {
      objects++;
      const owner = file.name.split('/')[1];
      if (!owner || !/^[A-Za-z0-9_-]{1,128}$/.test(owner)) { failures++; continue; }
      if (seen.has(owner)) continue;
      seen.add(owner); owners++;
      if (apply) try { await revokeAccountMediaCapabilities(owner, bucket); } catch { failures++; }
    }
    pageToken=next?.pageToken;
  }while(pageToken);
}
console.log(JSON.stringify({mode:apply?'apply':'dry-run',owners,objects,failures,productionApproval:false}));
if(failures)process.exitCode=1;

}
void main().catch(() => { console.error(JSON.stringify({event: 'media_capability_migration_failed'})); process.exitCode=1; });
