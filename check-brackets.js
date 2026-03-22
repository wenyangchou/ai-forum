const fs = require('fs');
const h = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
const m = h.match(/<script>([\s\S]*?)<\/script>/);
if (m) {
    console.log('Script length:', m[1].length);
    
    // 检查可疑模式
    const script = m[1];
    
    // 查找连续右括号
    const doubleParens = script.match(/\)\)\)/g);
    if (doubleParens) console.log('Triple parens found:', doubleParens.length);
    
    // 查找不匹配的括号
    let parens = 0, brackets = 0, braces = 0;
    for (let c of script) {
        if (c === '(') parens++;
        if (c === ')') parens--;
        if (c === '[') brackets++;
        if (c === ']') brackets--;
        if (c === '{') braces++;
        if (c === '}') braces--;
    }
    console.log('Parens balance:', parens, 'Brackets:', brackets, 'Braces:', braces);
}
