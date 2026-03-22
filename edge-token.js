const { chromium } = require('playwright');

async function main() {
    console.log('Starting with Edge profile...');
    const browser = await chromium.launch({
        headless: false,
        channel: 'msedge',
        args: ['--profile-directory=Default']
    });
    
    const page = await browser.newPage();
    await page.goto('https://github.com/settings/tokens/new?scopes=repo', { waitUntil: 'networkidle' });
    
    console.log('URL:', page.url());
    
    // 如果需要登录，等待
    if (page.url().includes('login')) {
        console.log('Please login in the browser, waiting...');
        await page.waitForURL('**/settings/tokens/new**', { timeout: 120000 });
    }
    
    console.log('Page loaded. Please create the token and copy it.');
    console.log('Press Ctrl+C when done or send me the token.');
    
    // 等待用户完成
    await new Promise(r => setTimeout(r, 180000));
    await browser.close();
}

main().catch(console.error);
