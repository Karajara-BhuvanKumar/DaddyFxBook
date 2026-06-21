const fs = require('fs');
const path = require('path');

function replaceJournal() {
  const file = path.join(__dirname, '../src/pages/Journal.tsx');
  let content = fs.readFileSync(file, 'utf8');

  // Fix inputs in Journal to not be conditional on isWinner and use the requested focus styles
  content = content.replace(/isWinner\s*\?\s*"focus:border-blue-[^"]+"\s*:\s*"focus:border-red-[^"]+"/g, '"focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"');

  // Fix input backgrounds
  content = content.replace(/w-full bg-\[#0B0B0B\] text-foreground border border-white\/\[0\.08\]/g, 'w-full bg-[#050505] text-foreground border border-white/[0.08]');
  content = content.replace(/w-12 h-8 bg-\[#0B0B0B\] text-foreground border border-white\/\[0\.08\]/g, 'w-12 h-8 bg-[#050505] text-foreground border border-white/[0.08]');
  content = content.replace(/flex-1 bg-\[#0B0B0B\] text-foreground border border-white\/\[0\.08\]/g, 'flex-1 bg-[#050505] text-foreground border border-white/[0.08]');

  fs.writeFileSync(file, content, 'utf8');
  console.log('Journal.tsx updated.');
}

replaceJournal();
