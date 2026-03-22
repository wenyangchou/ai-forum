const fs = require('fs');
const html = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (match) {
    const script = match[1];
    try {
        // 使用 Function 构造函数检查语法
        new Function(script);
        console.log('Syntax OK');
    } catch(e) {
        console.log('Error:', e.message);
        // 尝试找到错误位置
        const lines = script.split('\n');
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
            charCount += lines[i].length + 1;
            if (e.message.includes('line')) {
                const lineNum = e.message.match(/line (\d+)/);
                if (lineNum && parseInt(lineNum[1]) === i + 1) {
                    console.log('Problem at line', i + 1);
                    console.log('Content:', lines[i]);
                }
            }
        }
    }
}
