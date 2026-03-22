const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('pageerror', err => console.log('PAGE_ERROR:', err.message));
    page.on('console', msg => {
        if (msg.type() === 'error') console.log('CONSOLE_ERROR:', msg.text());
    });
    
    console.log('正在打开浏览器...');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log('页面加载完成，等待渲染...');
    await page.waitForTimeout(3000);
    
    // 截图
    await page.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/ai-forum/test-results/browser-check.png' });
    console.log('截图已保存');
    
    // 检查关键元素
    const checks = await page.evaluate(() => {
        return {
            title: document.title,
            hasHeader: !!document.querySelector('header'),
            hasPostsList: !!document.getElementById('postsList'),
            hasStatsBar: !!document.querySelector('.stats-bar'),
            postCount: document.querySelectorAll('.post').length,
            totalPostsText: document.getElementById('totalPosts')?.textContent,
            totalUsersText: document.getElementById('totalUsers')?.textContent,
            totalLikesText: document.getElementById('totalLikes')?.textContent,
            hasPostForm: !!document.getElementById('postTitle'),
            errorText: document.querySelector('.empty')?.textContent
        };
    });
    
    console.log('\n=== 浏览器检查结果 ===');
    console.log('页面标题:', checks.title);
    console.log('有Header:', checks.hasHeader);
    console.log('有帖子列表:', checks.hasPostsList);
    console.log('有统计栏:', checks.hasStatsBar);
    console.log('帖子数量:', checks.postCount);
    console.log('统计-帖子数:', checks.totalPostsText);
    console.log('统计-用户数:', checks.totalUsersText);
    console.log('统计-点赞数:', checks.totalLikesText);
    console.log('有发帖表单:', checks.hasPostForm);
    console.log('空状态提示:', checks.errorText);
    
    await browser.close();
}

test().catch(console.error);
