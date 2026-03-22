const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('pageerror', err => console.log('PAGE_ERROR:', err.message));
    page.on('console', msg => {
        if (msg.type() === 'error') console.log('CONSOLE_ERROR:', msg.text());
    });
    
    // 直接设置 HTML 来测试
    const fs = require('fs');
    const html = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
    
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    const stats = await page.evaluate(() => ({
        hasInit: typeof init === 'function',
        postsCount: window.posts ? window.posts.length : 'undefined',
        apiBase: typeof API_BASE !== 'undefined' ? API_BASE : 'undefined'
    }));
    
    console.log('Stats:', JSON.stringify(stats, null, 2));
    
    await browser.close();
}

test().catch(console.error);
