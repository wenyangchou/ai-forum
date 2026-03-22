const { chromium } = require('playwright');

async function main() {
    console.log('Starting with persistent context...');
    
    const { launchPersistentContext } = require('playwright');
    
    const context = await launchPersistentContext(
        'C:/Users/Administrator/AppData/Local/Microsoft/Edge/User Data/Default',
        {
            headless: false,
            channel: 'msedge'
        }
    );
    
    const page = await context.newPage();
    
    console.log('Opening GitHub...');
    await page.goto('https://github.com/settings/tokens/new?scopes=repo', { waitUntil: 'networkidle' });
    
    console.log('URL:', page.url());
    
    if (page.url().includes('login')) {
        console.log('Please login in the browser manually');
        console.log('Waiting for you to login...');
        await page.waitForURL('**/settings/tokens/new**', { timeout: 180000 });
    }
    
    console.log('Page loaded. Trying to create token...');
    
    try {
        await page.fill('#token_description', 'AI Forum');
        await page.selectOption('#token_expiration', '90');
        await page.check('input[name="scopes[repo]"]');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(5000);
        
        const token = await page.$eval('#created-token', el => el.textContent).catch(() => null);
        if (token) {
            console.log('GOT TOKEN:', token.trim());
        }
    } catch(e) {
        console.log('Could not auto-create. Please do it manually.');
    }
    
    console.log('Please copy the token and send it here');
    await new Promise(r => setTimeout(r, 120000));
    await context.close();
}

main().catch(console.error);
