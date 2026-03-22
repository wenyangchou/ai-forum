const fs = require('fs');
const html = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
    const script = scriptMatch[1];
    
    // 检查是否有 null 字符或其他不可见字符
    const badChars = [];
    for (let i = 0; i < script.length; i++) {
        const code = script.charCodeAt(i);
        if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
            badChars.push({ pos: i, code: code, char: script[i] });
        }
    }
    if (badChars.length > 0) {
        console.log('Bad characters found:', badChars);
    } else {
        console.log('No bad characters found');
    }
    
    // 检查是否有不完整的 Unicode 字符
    const unicodePattern = /[\uD800-\uDBFF][\uDC00-\uDFFF]?/g;
    const matches = script.match(unicodePattern);
    console.log('Unicode pairs found:', matches ? matches.length : 0);
}
