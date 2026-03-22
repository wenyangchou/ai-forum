const { chromium } = require('playwright');

async function main() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    console.log('Opening GitHub...');
    await page.goto('https://github.com/settings/tokens/new', { waitUntil: 'networkidle' });
    
    console.log('Page title:', await page.title());
    console.log('Please login and create a token with repo permission');
    console.log('Press Enter when done...');
    
    // 等待用户操作
    await new Promise(r => setTimeout(r, 60000));
    
    await browser.close();
    console.log('Done');
}

main().catch(console.error);
