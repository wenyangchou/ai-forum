const { chromium } = require('playwright');
const fs = require('fs');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('pageerror', err => console.log('ERROR:', err.message));
    
    // 读取实际的HTML
    const fullHtml = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
    
    // 提取script部分
    const scriptMatch = fullHtml.match(/<script>([\s\S]*?)<\/script>/);
    if (!scriptMatch) {
        console.log('No script found');
        return;
    }
    
    const script = scriptMatch[1];
    
    // 尝试分段加载来定位问题
    const lines = script.split('\n');
    let testScript = '';
    
    for (let i = 0; i < lines.length; i++) {
        testScript += lines[i] + '\n';
        
        // 每100行测试一次
        if ((i + 1) % 100 === 0 || i === lines.length - 1) {
            const testHtml = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body><script>${testScript}</script></body></html>`;
            
            const errors = [];
            page.on('pageerror', err => errors.push(err.message));
            
            await page.setContent(testHtml, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(500);
            
            console.log(`Lines 1-${i+1}: ${errors.length === 0 ? 'OK' : 'ERROR: ' + errors[0]}`);
            
            if (errors.length > 0) {
                console.log('Problem area:');
                const start = Math.max(0, i - 10);
                for (let j = start; j <= i; j++) {
                    console.log(`Line ${j+1}: ${lines[j].substring(0, 80)}`);
                }
                break;
            }
        }
    }
    
    await browser.close();
}

test().catch(console.error);
