// Read the recorded local edit history. Emit apply_patch input; never write source.
const fs = require('node:fs');
const crypto = require('node:crypto');
const history = '/Users/augustusedem/.codex/sessions/2026/09/27/rollout-2026-09-27T16-45-41-01a0caea-a2a0-7ab0-a1c0-f65f6e7f5dba_01a0e38b-242e-74e0-af69-ec96b643de79.jsonl';
const source = '/Users/augustusedem/.codex/worktrees/commune-loading/';
const target = '/Users/augustusedem/Commune/.comparisons/before-mockup-integration/';
const rows = fs.readFileSync(history,'utf8').trim().split('\n').map(JSON.parse);
const events = rows.filter(r => r.timestamp >= '2026-10-02T03:46:06.443Z' && r.timestamp <= '2026-10-02T04:05:52.000Z' && r.payload?.item?.type === 'FileChange' && r.type === 'event_msg');
// This attempted patch explicitly failed on directory creation; the later retry succeeded.
const successful = events.filter(r => r.timestamp !== '2026-10-02T03:59:52.974Z');
const content = new Map(); const patches = []; const hashes = {};
for (const event of successful.reverse()) {
  let patch = '*** Begin Patch\n';
  for (const [absolute, change] of Object.entries(event.payload.item.changes)) {
    if (!absolute.startsWith(source)) continue;
    const rel = absolute.slice(source.length);
    if (!content.has(rel)) content.set(rel, fs.readFileSync(target+rel,'utf8'));
    const current = content.get(rel);
    if (change.type === 'add') {
      if (current.trimEnd() !== change.content.trimEnd()) throw Error('Added file differs: '+rel);
      content.set(rel, null); patch += '*** Delete File: '+target+rel+'\n'; continue;
    }
    if (change.type !== 'update' || change.move_path) throw Error('Unexpected edit kind');
    const lines = change.unified_diff.trimEnd().split('\n');
    const hunks = [];
    for (const line of lines) {
      if (line.startsWith('@@')) { const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/); if (!m) throw Error('Bad hunk'); hunks.push({ old:Number(m[1]), start:Number(m[2]), lines:[] }); }
      else if (!line.startsWith('\\')) hunks.at(-1).lines.push(line);
    }
    const currentLines = current.split('\n');
    for (const h of [...hunks].reverse()) {
      const after = h.lines.filter(l=>!l.startsWith('-')).map(l=>l.slice(1));
      const before = h.lines.filter(l=>!l.startsWith('+')).map(l=>l.slice(1));
      const actual = currentLines.slice(h.start-1,h.start-1+after.length);
      if (JSON.stringify(actual)!==JSON.stringify(after)) throw Error('Hunk mismatch: '+rel+' at '+h.start);
      currentLines.splice(h.start-1,after.length,...before);
    }
    content.set(rel,currentLines.join('\n'));
    patch += '*** Update File: '+target+rel+'\n';
    for (const h of hunks) patch += '@@\n'+h.lines.map(l=>l.startsWith('+')?'-'+l.slice(1):l.startsWith('-')?'+'+l.slice(1):l).join('\n')+'\n';
  }
  if (patch !== '*** Begin Patch\n') patches.push(patch+'*** End Patch');
}
for(const [file,value] of content) hashes[file]=value===null?null:crypto.createHash('sha256').update(value).digest('hex');
console.log(JSON.stringify({patches,hashes}));
