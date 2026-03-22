const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('ERROR:', msg.text());
        }
    });
    
    page.on('pageerror', err => {
        console.log('PAGE ERROR:', err.message);
    });
    
    try {
        await page.goto('http://localhost:8080', { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(5000);
        
        // 检查是否有 init 函数
        const hasInit = await page.evaluate(() => typeof init === 'function');
        console.log('init function exists:', hasInit);
        
        // 手动调用 init
        if (hasInit) {
            await page.evaluate(() => init());
            await page.waitForTimeout(3000);
        }
        
        // 检查数据
        const stats = await page.evaluate(() => {
            return {
                totalPosts: document.getElementById('totalPosts')?.textContent,
                postsCount: document.querySelectorAll('.post').length,
                apiBase: typeof API_BASE !== 'undefined' ? API_BASE : 'undefined'
            };
        });
        console.log('Stats:', JSON.stringify(stats));
        
    } catch(e) {
        console.log('Exception:', e.message);
    }
    
    await browser.close();
}

test().catch(console.error);
