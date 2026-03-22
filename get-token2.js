const { chromium } = require('playwright');

async function main() {
    console.log('Starting with persistent context...');
    const browser = await chromium.launch({
        headless: false,
        channel: 'msedge',
        userDataDir: 'C:/Users/Administrator/AppData/Local/Microsoft/Edge/User Data/Default'
    });
    
    const context = browser.contexts()[0];
    const page = await context.newPage();
    
    console.log('Opening GitHub tokens page...');
    await page.goto('https://github.com/settings/tokens/new?scopes=repo', { waitUntil: 'networkidle' });
    
    console.log('URL:', page.url());
    
    if (page.url().includes('login')) {
        console.log('Not logged in. Trying different userDataDir...');
    } else {
        console.log('Logged in! Creating token...');
        
        try {
            // 填写描述
            await page.fill('#token_description', 'AI Forum Sync');
            console.log('Filled description');
            
            // 选择过期时间
            try {
                await page.selectOption('#token_expiration', '90');
            } catch(e) {}
            
            // 勾选repo权限
            try {
                await page.check('input[name="scopes[repo]"]');
                console.log('Checked repo');
            } catch(e) {}
            
            // 点击生成
            await page.click('button[type="submit"]');
            await page.waitForTimeout(3000);
            
            // 读取token
            const tokenEl = await page.$('#created-token');
            if (tokenEl) {
                const token = await tokenEl.textContent();
                console.log('TOKEN:', token.trim());
            }
        } catch(e) {
            console.log('Error:', e.message);
        }
    }
    
    console.log('Done. Please copy the token.');
    await new Promise(r => setTimeout(r, 60000));
    await browser.close();
}

main().catch(console.error);
