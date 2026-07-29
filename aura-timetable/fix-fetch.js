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
  if (content.includes("fetch('/api/") || content.includes("fetch(`/api/")) {
    content = content.replace(/fetch\('\/api\//g, "fetch('/aura/api/");
    content = content.replace(/fetch\(`\/api\//g, "fetch(`/aura/api/");
    fs.writeFileSync(file, content);
    console.log('Fixed:', file);
  }
});
