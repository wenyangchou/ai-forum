const { chromium } = require('playwright');

async function main() {
    console.log('Starting browser...');
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    // 打开token创建页面
    console.log('Opening GitHub tokens page...');
    await page.goto('https://github.com/settings/tokens/new?scopes=repo', { waitUntil: 'networkidle', timeout: 60000 });
    
    // 等待页面加载
    await page.waitForTimeout(3000);
    
    // 检查是否需要登录
    const title = await page.title();
    console.log('Page title:', title);
    
    // 如果需要登录，提示用户
    const url = page.url();
    console.log('Current URL:', url);
    
    if (url.includes('login')) {
        console.log('Please login manually and press Enter...');
        await browser.close();
        return;
    }
    
    // 填写token信息
    console.log('Filling token form...');
    
    // 填写Note
    try {
        await page.fill('#token_description', 'AI Forum Sync Token');
    } catch (e) {
        console.log('Could not fill description');
    }
    
    // 设置过期时间
    try {
        await page.selectOption('#token_expiration', '90');
    } catch (e) {
        console.log('Could not set expiration');
    }
    
    // 勾选repo权限
    try {
        const checkbox = await page.locator('input[name="scopes[repo]"]');
        if (await checkbox.count() > 0) {
            await checkbox.first().check();
            console.log('Checked repo scope');
        }
    } catch (e) {
        console.log('Could not check repo scope');
    }
    
    // 点击生成按钮
    try {
        await page.click('button[type="submit"]');
        console.log('Clicked generate button');
        await page.waitForTimeout(5000);
        
        // 获取生成的token
        const token = await page.locator('#created-token').textContent();
        console.log('Generated token:', token);
    } catch (e) {
        console.log('Could not generate token');
    }
    
    console.log('Please complete manually and let me know when done');
    await browser.close();
}

main().catch(console.error);
