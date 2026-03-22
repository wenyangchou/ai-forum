const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    console.log('=== Console Messages ===');
    consoleMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));
    
    const stats = await page.evaluate(() => {
        return {
            totalPosts: document.getElementById('totalPosts')?.textContent,
            totalUsers: document.getElementById('totalUsers')?.textContent,
            totalLikes: document.getElementById('totalLikes')?.textContent,
            postsCount: document.querySelectorAll('.post').length
        };
    });
    
    console.log('=== Stats ===', JSON.stringify(stats));
    await browser.close();
}

test().catch(console.error);
