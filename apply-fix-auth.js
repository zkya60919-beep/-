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
let totalPatched = 0;
files.forEach(file => {
  let txt = fs.readFileSync(file, 'utf8');
  const orig = txt;

  // Remove Authorization: `...` occurrences inside headers objects
  // 1. Remove 'Authorization: `...`' (with optional trailing comma)
  txt = txt.replace(/\s*Authorization\s*:\s*`[^`]*`\s*,?/g, '');

  // 2. If there are duplicated commas like ', ,' or '{ ,' fix them
  txt = txt.replace(/,\s*,/g, ',');
  txt = txt.replace(/\{\s*,/g, '{ ');

  // 3. Tidy trailing commas before closing brace '},' -> '}' only if incorrect
  txt = txt.replace(/,\s*\}/g, ' }');

  if (txt !== orig) {
    fs.writeFileSync(file, txt, 'utf8');
    console.log('Patched:', file);
    totalPatched++;
  }
});
console.log('Done. Files patched:', totalPatched);