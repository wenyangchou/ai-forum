const http = require('http');

const postData = JSON.stringify({
    title: '测试帖子-这是一个非常非常长的标题用来测试验证功能是否正常工作如果超过200个字符就会被拒绝这是第一百五十个字符测试一下看看会不会被拒绝啊哈哈',
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
