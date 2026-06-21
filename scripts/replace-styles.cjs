const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

function replaceStyles(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Replace white borders
  // "Replace every white border with: border-color: rgba(255,255,255,0.08)"
  // "Never use #FFFFFF, rgb(255,255,255), white for borders."
  // "Hover border: rgba(37,99,235,0.35)"
  
  // Tailwind regexes
  // border-white/5, border-white/10, border-white/20, border-white
  content = content.replace(/border-white\/(5|10|20|50|100)/g, 'border-white/[0.08]');
  content = content.replace(/border-white(?!\/)/g, 'border-white/[0.08]');
  content = content.replace(/border-\[#E5E7EB\]/g, 'border-white/[0.08]');
  content = content.replace(/border-border/g, 'border-white/[0.08]');
  
  content = content.replace(/hover:border-white\/(10|20)/g, 'hover:border-blue-600/[0.35]');
  content = content.replace(/hover:border-zinc-300/g, 'hover:border-blue-600/[0.35]');
  content = content.replace(/hover:border-zinc-800/g, 'hover:border-blue-600/[0.35]');
  
  // 2. Card Polish
  // Background #0B0B0B -> bg-[#0B0B0B]
  // Border: 1px solid rgba(255,255,255,0.06) -> border-white/[0.06]
  // Border radius: 20px -> rounded-[20px]
  // Box shadow: 0 4px 30px rgba(0,0,0,.35) -> shadow-[0_4px_30px_rgba(0,0,0,0.35)]
  // We can't safely regex all cards, but we can replace common background colors in analysis
  content = content.replace(/bg-\[#080808\]/g, 'bg-[#0B0B0B]');
  content = content.replace(/bg-\[#0c0c0c\]/g, 'bg-[#0B0B0B]');
  content = content.replace(/bg-\[#0A0A0A\]/g, 'bg-[#0B0B0B]');
  content = content.replace(/bg-card/g, 'bg-[#0B0B0B]');
  
  // Replace card border where it was just changed to [0.08] if it's on a card, actually simpler to just replace border-white/[0.08] with border-white/[0.06] on known card classes
  content = content.replace(/bg-\[#0B0B0B\] border border-white\/\[0\.08\]/g, 'bg-[#0B0B0B] border border-white/[0.06] rounded-[20px] shadow-[0_4px_30px_rgba(0,0,0,0.35)]');
  content = content.replace(/rounded-2xl/g, 'rounded-[20px]');
  content = content.replace(/rounded-xl/g, 'rounded-[20px]');
  
  // 4. Tables
  content = content.replace(/border-b border-white\/\[0\.08\]/g, 'border-b border-white/[0.05]');
  content = content.replace(/hover:bg-\[#121212\]/g, 'hover:bg-white/[0.02]');
  content = content.replace(/hover:bg-zinc-50/g, 'hover:bg-white/[0.02]');
  content = content.replace(/hover:bg-muted\/50/g, 'hover:bg-white/[0.02]');
  content = content.replace(/hover:bg-white\/5(?!\d)/g, 'hover:bg-white/[0.02]');
  
  // 5. Buttons
  content = content.replace(/hover:bg-primary\/90/g, 'hover:bg-blue-500');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

walkDir(path.join(__dirname, '../src'), replaceStyles);
