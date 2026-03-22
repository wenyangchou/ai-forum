const http = require('http');

const postData = JSON.stringify({
    title: '测试帖子-202603212230',
    content: '这是测试内容，验证发帖功能正常',
    author: '测试用户'
});

const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/posts',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
        console.log('状态码:', res.statusCode);
        console.log('响应:', body);
    });
});

req.on('error', (e) => {
    console.error('请求错误:', e.message);
});

req.write(postData);
req.end();
