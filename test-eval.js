const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // 在页面加载之前注入脚本
    page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('ERROR:', err.message));
    
    await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 尝试逐行执行代码来找到错误
    const lines = [
        "console.log('test1')",
        "const x = 1; console.log('test2')",
        "function test() { return 1; } console.log('test3')",
        "window.onerror = function(msg, url, line, col, error) { console.log('error handler'); return false; }; console.log('test4')"
    ];
    
    for (const line of lines) {
        try {
            await page.evaluate(l => eval(l), line);
            console.log('OK:', line.substring(0, 50));
        } catch(e) {
            console.log('FAIL:', line.substring(0, 50), e.message);
        }
    }
    
    await browser.close();
}

test().catch(console.error);
