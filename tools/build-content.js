#!/usr/bin/env node
const fs = require('fs');
const pairs = [['content/content.json', 'content/content.js', '__CONTENT__'], ['content/lessons.json', 'content/lessons.js', '__LESSONS__']];
for (const [src, dst, key] of pairs) {
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));
  fs.writeFileSync(dst, 'window.' + key + ' = ' + JSON.stringify(data, null, 2) + ';\n');
  console.log(src, '->', dst);
}
