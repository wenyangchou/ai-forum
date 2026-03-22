const { chromium } = require('playwright');
const fs = require('fs');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('pageerror', err => console.log('ERROR:', err.message));
    
    // 测试简单版本
    const simpleHtml = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/test-simple.html', 'utf8');
    await page.setContent(simpleHtml, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const postsText = await page.evaluate(() => document.getElementById('posts').innerHTML);
    console.log('Simple version posts:', postsText.substring(0, 200));
    
    // 测试完整版本
    const fullHtml = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
    await page.setContent(fullHtml, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const postsText2 = await page.evaluate(() => document.getElementById('postsList')?.innerHTML || 'N/A');
    console.log('Full version postsList:', postsText2.substring(0, 200));
    
    await browser.close();
}

test().catch(console.error);
