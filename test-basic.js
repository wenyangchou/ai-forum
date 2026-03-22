const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('pageerror', err => {
        console.log('PAGE_ERROR:', err.message);
        console.log('STACK:', err.stack);
    });
    
    // 测试基础HTML
    const testHtml = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<script>
const API_BASE = 'http://localhost:8080';
let posts = [];

async function init() {
    console.log('init called');
    const response = await fetch(API_BASE + '/api/stats');
    const stats = await response.json();
    console.log('stats:', stats);
    document.body.innerHTML = '<div>Posts: ' + stats.totalPosts + '</div>';
}

init();
</script>
</body>
</html>`;
    
    await page.setContent(testHtml, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    const bodyText = await page.evaluate(() => document.body.innerHTML);
    console.log('Body:', bodyText);
    
    await browser.close();
}

test().catch(console.error);
