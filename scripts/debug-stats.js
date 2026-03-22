const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Listen to console messages
    page.on('console', msg => {
        console.log('PAGE LOG:', msg.text());
    });
    
    // Listen to page errors
    page.on('pageerror', error => {
        console.log('PAGE ERROR:', error.message);
        console.log('PAGE ERROR STACK:', error.stack);
    });
    
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    console.log('=== After wait ===');
    const totalPosts = await page.$eval('#totalPosts', el => el.textContent);
    console.log('totalPosts:', totalPosts);
    
    await browser.close();
})();
