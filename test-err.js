const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        console.log('CONSOLE:', msg.type(), msg.text());
    });
    
    page.on('pageerror', err => {
        console.log('PAGE ERROR:', err.message);
        console.log('STACK:', err.stack);
    });
    
    await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await browser.close();
}

test().catch(console.error);
