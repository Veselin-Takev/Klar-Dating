import fs from 'node:fs';
const files = ['src/components/DatePlannerWidget.tsx','src/components/DateCalendar.tsx','src/server/routes/datePlans.ts','functions/src/dateReminders.ts','firestore.rules'];
for (const file of files) if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
for (const file of files.slice(0,2)) {
  const text = fs.readFileSync(file,'utf8');
  if (/klarStorage\.(?:getItem|setItem|removeItem)\(['"]klar_(planned_dates|date_availabilities)/.test(text)) throw new Error(`${file} uses client persistence for calendar state`);
}

const forbidden = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory() && entry.name !== 'node_modules') walk(path);
    else if (/\.(tsx?|mjs)$/.test(entry.name)) {
      const source = fs.readFileSync(path, 'utf8');
      if (/klar_(planned_dates|date_availabilities|date_checklist_)/.test(source)) forbidden.push(path);
    }
  }
}
walk('src');
if (forbidden.length) throw new Error(`Legacy browser calendar/checklist persistence remains: ${forbidden.join(', ')}`);

const route = fs.readFileSync(files[2],'utf8');
const reminder = fs.readFileSync(files[3],'utf8');
for (const marker of ["/date-plans", "/date-availability", 'verifyConnection', 'reminderAt']) if (!route.includes(marker)) throw new Error(`Missing date planner control: ${marker}`);
for (const marker of ['onSchedule', 'every 5 minutes', 'reminderClaimedAt', 'reminderSentAt']) if (!reminder.includes(marker)) throw new Error(`Missing reminder control: ${marker}`);
const rules = fs.readFileSync(files[4],'utf8');
for (const marker of ['match /users/{userId}/datePlans/{planId}', 'match /users/{userId}/dateAvailability/{availabilityId}', 'allow create, update, delete: if false;']) if (!rules.includes(marker)) throw new Error(`Missing Firestore date rule: ${marker}`);
console.log('Date planner/calendar boundary: PASS');
