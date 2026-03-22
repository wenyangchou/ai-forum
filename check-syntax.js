const fs = require('fs');
const html = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (match) {
    const script = match[1];
    const lines = script.split('\n');
    lines.forEach((l, i) => {
        if (l.includes(')))') || l.includes('()') || l.includes('),')) {
            console.log('Line ' + (i+1) + ':', l.trim().substring(0, 100));
        }
    });
}
