import fs from 'fs';
const data = JSON.parse(fs.readFileSync('C:/Users/rondp/.gemini/antigravity-ide/brain/6cebb992-400a-49bc-983b-5d3cd576c227/.system_generated/steps/1190/content.md', 'utf8').split('---')[1]);
const run17 = data.workflow_runs.find(r => r.run_number === 17);
console.log(run17.jobs_url);
