const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // 禁用 JavaScript 来获取原始 HTML
    await page.setJavaScriptEnabled(false);
    await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const html = await page.content();
    console.log(html.substring(0, 3000));
    
    await browser.close();
}

test().catch(console.error);
