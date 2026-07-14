const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'js');
if (!fs.existsSync(root)) {
  console.error('Target folder not found:', root);
  process.exit(1);
}

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) results = results.concat(walk(p));
    else results.push(p);
  });
  return results;
}

const files = walk(root).filter(f => f.endsWith('.js'));
const pattern = /Authorization:\s*`\*+/g;
let patched = 0;
files.forEach(file => {
  let txt = fs.readFileSync(file, 'utf8');
  if (pattern.test(txt)) {
    const newTxt = txt.replace(pattern, 'Authorization: `Bearer ${CONFIG.SUPABASE.ANON_KEY}`');
    fs.writeFileSync(file, newTxt, 'utf8');
    console.log('Patched:', file);
    patched++;
  }
});
console.log('Finished. Files patched:', patched);
