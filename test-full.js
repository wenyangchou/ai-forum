const { chromium } = require('playwright');
const fs = require('fs');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    
    // 读取实际的HTML
    const fullHtml = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');
    
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    console.log('Errors:', errors);
    
    // 检查哪个函数可以执行
    const results = await page.evaluate(() => {
        return {
            hasAPI: typeof API_BASE !== 'undefined',
            hasPosts: typeof posts !== 'undefined',
            hasInit: typeof init === 'function',
            hasLoadPosts: typeof loadPosts === 'function',
            hasRenderPosts: typeof renderPosts === 'function'
        };
    });
    
    console.log('Functions:', results);
    
    await browser.close();
}

test().catch(console.error);
