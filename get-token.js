const { chromium } = require('playwright');

async function main() {
    console.log('Starting browser...');
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    console.log('Opening GitHub...');
    await page.goto('https://github.com/settings/tokens', { waitUntil: 'networkidle', timeout: 60000 });
    
    await page.waitForTimeout(5000);
    
    const url = page.url();
    console.log('URL:', url);
    
    // 如果已登录，会显示tokens列表页面
    if (url.includes('login')) {
        console.log('Please login in the browser, then wait...');
        await page.waitForURL('**/settings/tokens**', { timeout: 120000 });
        console.log('Logged in! URL:', page.url());
    }
    
    // 点击生成新token按钮
    console.log('Looking for generate button...');
    try {
        await page.click('a[href="/settings/tokens/new"]');
        console.log('Clicked new token button');
        await page.waitForTimeout(3000);
    } catch (e) {
        console.log('Trying different approach...');
    }
    
    // 填写表单
    try {
        await page.fill('#token_description', 'AI Forum');
        console.log('Filled description');
    } catch (e) {}
    
    try {
        await page.click('input[name="scopes[repo]"]');
        console.log('Clicked repo checkbox');
    } catch (e) {}
    
    try {
        await page.click('button[type="submit"]');
        console.log('Clicked generate');
        await page.waitForTimeout(5000);
        
        // 获取token
        const tokenArea = await page.$('#created-token, .token-value, [data-testid="token-value"]');
        if (tokenArea) {
            const token = await tokenArea.textContent();
            console.log('TOKEN:', token.trim());
        }
    } catch (e) {}
    
    console.log('Please copy the token and send it to me');
    console.log('Press Ctrl+C when done');
    
    await new Promise(r => setTimeout(r, 300000));
    await browser.close();
}

main().catch(console.error);
