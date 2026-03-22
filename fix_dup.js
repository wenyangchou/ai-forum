const fs = require('fs');
let content = fs.readFileSync(__dirname + '/server.js', 'utf8');

// Find second occurrence of the single post endpoint
const first = content.indexOf('// API: 获取单个帖子');
const second = content.indexOf('// API: 获取单个帖子', first + 1);

if (second > 0) {
    // Find the end of this block
    const afterSecond = content.indexOf('// API: 点赞帖子', second);
    if (afterSecond > 0) {
        // Remove from second occurrence to the next API comment
        const before = content.substring(0, second);
        const after = content.substring(afterSecond);
        content = before + after;
        fs.writeFileSync(__dirname + '/server.js', content);
        console.log('Removed duplicate endpoint');
    }
} else {
    console.log('No duplicate found');
}
