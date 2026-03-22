const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const requests = [];
    page.on('request', req => requests.push({ url: req.url(), method: req.method() }));
    page.on('response', res => {
        const req = requests.find(r => r.url === res.url());
        if (req) req.status = res.status();
    });
    
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    console.log('=== Network Requests ===');
    requests.forEach(r => console.log(`${r.method} ${r.url} - ${r.status || 'pending'}`));
    
    await browser.close();
}

test().catch(console.error);
