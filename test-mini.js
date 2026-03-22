const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('pageerror', err => console.log('ERROR:', err.message));
    
    // 测试 1：原始文件
    console.log('=== Test 1: Full script from file ===');
    const fs = require('fs');
    const html1 = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
    await page.setContent(html1, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    // 测试 2：简化脚本
    console.log('\n=== Test 2: Simple script ===');
    const simpleHtml = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<script>
const API_BASE = 'http://localhost:8080';
let posts = [];
async function init() { console.log('init'); }
init();
</script>
</body>
</html>`;
    await page.setContent(simpleHtml, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    // 测试 3：使用原始脚本的前几行
    console.log('\n=== Test 3: Partial script (first 30 lines) ===');
    const scriptMatch = html1.match(/<script>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
        const partialScript = scriptMatch[1].split('\n').slice(0, 30).join('\n');
        const partialHtml = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<script>
${partialScript}
</script>
</body>
</html>`;
        await page.setContent(partialHtml, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
    }
    
    await browser.close();
}

test().catch(console.error);
