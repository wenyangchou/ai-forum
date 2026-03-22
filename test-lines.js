const { chromium } = require('playwright');
const fs = require('fs');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('pageerror', err => console.log('ERROR at line', err.message));
    
    const html = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    const script = scriptMatch[1];
    const lines = script.split('\n');
    
    // 逐行增加来测试
    for (let n = 10; n <= lines.length; n += 10) {
        const partialScript = lines.slice(0, n).join('\n');
        const testHtml = `<!DOCTYPE html><html><head><title>Test</title></head><body><script>\n${partialScript}\n</script></body></html>`;
        
        await page.setContent(testHtml, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        
        const hasError = await page.evaluate(() => {
            return typeof init === 'function';
        });
        
        console.log(`Lines 1-${n}: ${hasError ? 'OK' : 'FAIL'}`);
    }
    
    await browser.close();
}

test().catch(console.error);
