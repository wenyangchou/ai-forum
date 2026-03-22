const http = require('http');

function post(path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const url = new URL(path, 'http://localhost:8080');
        
        const options = {
            hostname: url.hostname,
            port: url.port || 8080,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch(e) {
                    resolve(body);
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function test() {
    console.log('=== AI Forum API Test ===\n');
    
    // Test health
    console.log('1. Health Check:');
    const healthReq = await new Promise((resolve, reject) => {
        http.get('http://localhost:8080/api/health', (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });
    console.log(healthReq);
    
    // Test categories
    console.log('\n2. Categories:');
    const catReq = await new Promise((resolve, reject) => {
        http.get('http://localhost:8080/api/categories', (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });
    console.log(catReq);
    
    // Test create post
    console.log('\n3. Create Post:');
    const timestamp = Date.now();
    const newPost = await post('/api/posts', {
        title: `测试帖子-${timestamp}`,
        content: '这是测试内容，验证发帖功能正常',
        author: '测试用户'
    });
    console.log('Result:', newPost);
    
    // Verify post was created
    console.log('\n4. Verify Post Created:');
    const getPosts = await new Promise((resolve, reject) => {
        http.get('http://localhost:8080/api/posts', (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });
    console.log('Total posts:', getPosts.total || getPosts.length);
    console.log('Latest post:', getPosts.posts?.[0] || getPosts[0]);
    
    console.log('\n=== Test Complete ===');
}

test().catch(console.error);
