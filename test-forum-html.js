const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('pageerror', err => console.log('ERROR:', err.message));
    
    // 测试 forum.html
    const fs = require('fs');
    const html = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/forum.html', 'utf8');
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const posts = await page.evaluate(() => document.querySelectorAll('.post').length);
    console.log('Posts count:', posts);
    
    await browser.close();
}

test().catch(console.error);
