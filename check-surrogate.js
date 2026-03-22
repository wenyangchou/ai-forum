const fs = require('fs');
const html = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
    const script = scriptMatch[1];
    
    // 检查不完整的 surrogate pair
    let prevChar = '';
    for (let i = 0; i < script.length; i++) {
        const code = script.charCodeAt(i);
        // 高 surrogate
        if (code >= 0xD800 && code <= 0xDBFF) {
            prevChar = script[i];
            // 检查下一个字符
            if (i + 1 < script.length) {
                const nextCode = script.charCodeAt(i + 1);
                // 低 surrogate 应该在 0xDC00-0xDFFF
                if (nextCode < 0xDC00 || nextCode > 0xDFFF) {
                    console.log(`Incomplete surrogate at ${i}: ${script[i]} (${code.toString(16)}) followed by ${script[i+1]} (${nextCode.toString(16)})`);
                }
            }
        }
    }
    console.log('Check complete');
}
