const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'k8s-els-ai');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml'));
for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/image: (harishdell\/els-ai-[a-z-]+):1\.6/g, 'image: $1:1.7');
  fs.writeFileSync(filePath, content);
}
console.log('Done');
