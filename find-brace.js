const fs = require('fs');
const h = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
const m = h.match(/<script>([\s\S]*?)<\/script>/);
if (m) {
    const script = m[1];
    const lines = script.split('\n');
    
    let braceCount = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        const diff = openBraces - closeBraces;
        
        if (diff !== 0) {
            console.log(`Line ${i+1}: +${openBraces} -{closeBraces} = ${diff}`);
            console.log('  ', line.trim().substring(0, 80));
        }
        braceCount += diff;
    }
    console.log('\nFinal brace count:', braceCount);
}
