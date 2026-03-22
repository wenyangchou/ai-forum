const fs = require('fs');
const h = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');

const scriptStart = h.indexOf('<script>');
const scriptEnd = h.indexOf('</script>');
const script = h.substring(scriptStart + 8, scriptEnd);

// 检查字符串中的不匹配引号
let inString = false;
let stringChar = '';
let lineNum = 1;

for (let i = 0; i < script.length; i++) {
    const char = script[i];
    
    if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
    } else if (inString && char === stringChar && script[i-1] !== '\\') {
        inString = false;
        stringChar = '';
    }
    
    if (char === '\n') lineNum++;
    
    // 检查可疑的模式
    if (lineNum >= 525 && lineNum <= 535) {
        if (char === ')' || char === '(' || char === '}') {
            console.log(`Line ${lineNum}, pos ${i}: ${char}`);
        }
    }
}

console.log('\nLine count:', lineNum);

// 查找问题行
const lines = script.split('\n');
console.log('\nLine 528-535:');
for (let i = 527; i < 536 && i < lines.length; i++) {
    console.log(`Line ${i+1}:`, lines[i].substring(0, 100));
}
