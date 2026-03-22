const fs = require('fs');
const html = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');

// 提取 script 内容
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
    console.log('No script found');
    process.exit(1);
}

const script = scriptMatch[1];

// 尝试解析
const acorn = require('acorn');
try {
    acorn.parse(script, {
        ecmaVersion: 2020,
        sourceType: 'script',
        locations: true
    });
    console.log('Syntax OK');
} catch(e) {
    console.log('Error at line', e.loc.line, 'column', e.loc.column);
    console.log('Message:', e.message);
    
    const lines = script.split('\n');
    if (e.loc.line > 0 && e.loc.line <= lines.length) {
        console.log('\nLine content:');
        console.log(lines[e.loc.line - 1]);
    }
}
