const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // 在页面加载之前就捕获错误
    page.on('pageerror', err => {
        console.log('PAGE_ERROR:', err.message);
    });
    
    page.on('console', msg => {
        console.log('CONSOLE_' + msg.type().toUpperCase() + ':', msg.text());
    });
    
    await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 获取页面源代码
    const html = await page.content();
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
        console.log('\n=== First 500 chars of script ===');
        console.log(scriptMatch[1].substring(0, 500));
    }
    
    await browser.close();
}

test().catch(console.error);
