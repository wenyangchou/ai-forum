const http = require('http');

async function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function main() {
    console.log('Connecting to Edge...');
    
    try {
        const version = await getJson('http://localhost:9222/json/version');
        console.log('Edge version:', version['Browser']);
        
        const pages = await getJson('http://localhost:9222/json/list');
        console.log('Pages:', pages.map(p => p.url).join('\n'));
        
        // 找到GitHub页面
        const githubPage = pages.find(p => p.url.includes('github.com/settings/tokens'));
        if (githubPage) {
            console.log('\nFound GitHub page:', githubPage.url);
            console.log('Page ID:', githubPage.id);
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

main();
