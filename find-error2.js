const fs = require('fs');
const html = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (match) {
    const script = match[1];
    const lines = script.split('\n');
    
    // 逐行检查
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 跳过空行和注释行
        if (!line.trim() || line.trim().startsWith('//')) continue;
        
        try {
            // 尝试解析到当前行
            new Function(lines.slice(0, i + 1).join('\n'));
        } catch(e) {
            if (e.message.includes('Unexpected token')) {
                console.log('Error at line', i + 1);
                console.log('Content:', line);
                console.log('Error:', e.message);
                break;
            }
        }
    }
}
