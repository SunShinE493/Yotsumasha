const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/taiyo/Downloads/Yotsumasha/Yotsumasha-my-local-changes/aura-timetable/src';

function walk(d) {
  let results = [];
  const list = fs.readdirSync(d);
  list.forEach(file => {
    file = path.join(d, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

walk(dir).forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Revert the wrong replacements (Express routes should remain /api/...)
  const reverts = [
    { from: "/aura/api/csrf", to: "/api/csrf" },
    { from: "/aura/api/user", to: "/api/user" },
    { from: "/aura/api/aura/gist/", to: "/api/aura/gist/" },
    { from: "/aura/api/aura/ai/", to: "/api/aura/ai/" }
  ];

  reverts.forEach(r => {
    if (content.includes(r.from)) {
      content = content.split(r.from).join(r.to);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Reverted Express routes:', file);
  }
});
