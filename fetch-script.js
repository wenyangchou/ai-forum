const http = require('http');
http.get('http://localhost:8080/', res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const m = data.match(/<script>([\s\S]*?)<\/script>/);
        if (m) {
            console.log('=== First 1000 chars of script ===');
            console.log(m[1].substring(0, 1000));
            console.log('\n=== Last 500 chars of script ===');
            console.log(m[1].substring(m[1].length - 500));
        } else {
            console.log('No script found');
        }
    });
});
