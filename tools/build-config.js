#!/usr/bin/env node
const fs = require('fs');
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
fs.writeFileSync('content/config.js',
  'window.__SUPABASE_URL__ = ' + JSON.stringify(url) + ';\n' +
  'window.__SUPABASE_ANON_KEY__ = ' + JSON.stringify(key) + ';\n');
console.log('config built (url ' + (url ? 'set' : 'empty') + ')');
