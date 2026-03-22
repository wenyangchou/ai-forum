const { chromium } = require('playwright');

async function findSyntaxError() {
    const fs = require('fs');
    const html = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
    
    const scriptStart = html.indexOf('<script>');
    const scriptEnd = html.indexOf('</script>');
    const script = html.substring(scriptStart + 8, scriptEnd);
    
    const lines = script.split('\n');
    
    // 尝试找到问题行
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 跳过空行
        if (!line.trim()) continue;
        
        try {
            new Function(line);
        } catch (e) {
            if (e.message.includes('Unexpected token') || e.message.includes('Unexpected end')) {
                console.log(`问题行 ${i + 1}:`, line.substring(0, 100));
                console.log('错误:', e.message);
                
                // 打印上下文
                const start = Math.max(0, i - 2);
                const end = Math.min(lines.length, i + 3);
                console.log('\n上下文:');
                for (let j = start; j < end; j++) {
                    console.log(`${j + 1}: ${lines[j].substring(0, 80)}`);
                }
                break;
            }
        }
    }
}

findSyntaxError();
