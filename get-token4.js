const { chromium } = require('playwright');

async function main() {
    console.log('Starting browser...');
    const browser = await chromium.launch({
        headless: false,
        channel: 'msedge'
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('Opening GitHub...');
    await page.goto('https://github.com/settings/tokens/new?scopes=repo', { waitUntil: 'networkidle', timeout: 60000 });
    
    console.log('Current URL:', page.url());
    
    // 检查是否已登录
    if (page.url().includes('login')) {
        console.log('NOT LOGGED IN - Please login manually');
        console.log('Waiting for login...');
        
        // 等待用户登录
        await page.waitForURL('**/settings/tokens**', { timeout: 300000 });
        console.log('Login detected! URL:', page.url());
        
        // 点击新建token
        await page.goto('https://github.com/settings/tokens/new?scopes=repo');
        await page.waitForTimeout(2000);
    }
    
    console.log('On token page. Trying to fill form...');
    
    try {
        // 填写note
        await page.fill('#token_description', 'AI Forum Sync Token');
        
        // 设置90天过期
        await page.selectOption('#token_expiration', '90');
        
        // 确认repo权限已勾选
        const repoChecked = await page.isChecked('input[name="scopes[repo]"]');
        if (!repoChecked) {
            await page.check('input[name="scopes[repo]"]');
        }
        
        // 点击生成
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        // 获取token
        const tokenEl = await page.$('#created-token');
        if (tokenEl) {
            const token = await tokenEl.textContent();
            console.log('\n=== TOKEN FOUND ===');
            console.log(token.trim());
            console.log('====================\n');
        } else {
            console.log('Token element not found');
        }
    } catch (e) {
        console.log('Error:', e.message);
        console.log('Please create token manually');
    }
    
    console.log('Press Enter to close...');
    await new Promise(r => setTimeout(r, 60000));
    await browser.close();
}

main().catch(console.error);
