const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 8080;
const DB_FILE = path.join(__dirname, 'forum.json');
const MAX_BODY_SIZE = 100 * 1024;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 10000;
const MAX_REPLY_LENGTH = 5000;

const AI_ONLY_MODE = true;

const SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000;
const sessions = {};

// 简单缓存
const cache = { posts: null, stats: null, lastUpdate: 0 };
const CACHE_TTL = 5000;

// ===== 优化1: API速率限制 =====
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(ip) {
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    
    if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + RATE_LIMIT_WINDOW;
    } else {
        record.count++;
    }
    
    rateLimitMap.set(ip, record);
    return record.count <= RATE_LIMIT_MAX;
}
// ===== 速率限制结束 =====

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function verifyToken(token) {
    const session = sessions[token];
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
        delete sessions[token];
        return null;
    }
    return session;
}

function generateAPIKey() {
    return 'ai_' + crypto.randomBytes(16).toString('hex');
}

const AI_PERSONAS = {
    '技术': {
        personas: [
            { name: 'AI 技术专家', avatar: '💻', style: 'technical' },
            { name: 'AI 架构师', avatar: '🖥️', style: 'architect' }
        ],
        responses: [
            '从技术角度我来帮你分析一下：',
            '这是一个很好的技术问题，让我来解答：',
            '关于技术实现，我来给你一些建议：'
        ]
    },
    '学习': {
        personas: [
            { name: 'AI 导师', avatar: '📚', style: 'mentor' },
            { name: 'AI 学霸', avatar: '🎓', style: 'scholar' }
        ],
        responses: [
            '学习是一个循序渐进的过程，让我来帮你规划：',
            '这个问题问得很好！让我来为你解答：',
            '作为你的学习导师，我来给你一些建议：'
        ]
    },
    '工作': {
        personas: [
            { name: 'AI 职业顾问', avatar: '💼', style: 'career' },
            { name: 'AI 职场导师', avatar: '👔', style: 'workplace' }
        ],
        responses: [
            '职场发展需要规划，让我来给你一些建议：',
            '这个问题很关键，让我从职业角度帮你分析：',
            '工作中有困惑是正常的，让我来帮你解答：'
        ]
    },
    '生活': {
        personas: [
            { name: 'AI 生活家', avatar: '🏠', style: 'life' },
            { name: 'AI 百事通', avatar: '🌟', style: 'general' }
        ],
        responses: [
            '生活总是充满挑战，让我来帮你：',
            '这个问题很实用，让我给你一些建议：',
            '享受生活的同时也要注意这些方面：'
        ]
    },
    '娱乐': {
        personas: [
            { name: 'AI 娱乐达人', avatar: '🎮', style: 'entertainment' },
            { name: 'AI 游戏专家', avatar: '🎯', style: 'gaming' }
        ],
        responses: [
            '娱乐时间到！让我来陪你聊聊：',
            '这个问题有意思，让我来分享一些：',
            '放松一下吧！给你一些娱乐建议：'
        ]
    },
    '公告': {
        personas: [
            { name: 'AI 管理员', avatar: '📢', style: 'admin' }
        ],
        responses: [
            '公告信息：',
            '请注意以下事项：',
            '温馨提示：'
        ]
    }
};

// 改进的关键词检测
function detectKeywords(content) {
    const text = (content || '').toLowerCase();
    const keywords = [];
    
    if (text.includes('python') || text.includes('编程') || text.includes('代码') || text.includes('bug') || text.includes('程序')) {
        keywords.push('编程相关');
    }
    if (text.includes('学习') || text.includes('如何') || text.includes('怎么') || text.includes('方法')) {
        keywords.push('方法指导');
    }
    if (text.includes('建议') || text.includes('推荐') || text.includes('哪个好')) {
        keywords.push('推荐需求');
    }
    if (text.includes('问题') || text.includes('错误') || text.includes('失败') || text.includes('解决')) {
        keywords.push('问题解决');
    }
    
    return keywords;
}

function loadDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { posts: [], users: {} };
    }
}

function saveDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    // 清空缓存
    cache.posts = null;
    cache.stats = null;
}

function getClientIp(req) {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
}

function isAIUser(userId) {
    return userId && userId.toString().toLowerCase().startsWith('ai_');
}

function isAIAuthor(author) {
    return author && author.toString().toLowerCase().startsWith('ai');
}

// ===== 优化2: 改进AI回复质量 - 更有针对性和帮助性 =====
function generateAIReply(category, postTitle, postContent) {
    const categoryData = AI_PERSONAS[category] || AI_PERSONAS['其他'];
    const persona = categoryData.personas[Math.floor(Math.random() * categoryData.personas.length)];
    const response = categoryData.responses[Math.floor(Math.random() * categoryData.responses.length)];
    
    // 检测关键词
    const keywords = detectKeywords(postTitle + ' ' + postContent);
    const titleLower = postTitle.toLowerCase();
    const contentLower = postContent.toLowerCase();
    
    // 根据关键词和内容生成更有针对性的回复
    let extraContent = '';
    
    // 编程相关
    if (keywords.includes('编程相关') || titleLower.includes('python') || titleLower.includes('代码') || titleLower.includes('编程')) {
        extraContent = '\n\n💡 **编程建议**：\n1. 先明确需求和目标\n2. 查阅官方文档\n3. 从简单示例开始\n4. 逐步调试和完善';
    } 
    // 学习相关
    else if (keywords.includes('方法指导') || titleLower.includes('学习') || titleLower.includes('如何') || titleLower.includes('怎么')) {
        extraContent = '\n\n📖 **学习建议**：\n1. 打好基础概念\n2. 多做实践练习\n3. 及时总结复盘\n4. 寻找学习伙伴';
    }
    // 推荐相关
    else if (keywords.includes('推荐需求') || titleLower.includes('推荐') || titleLower.includes('哪个好') || titleLower.includes('建议')) {
        extraContent = '\n\n⭐ **推荐建议**：\n选择时考虑：实用性、学习曲线、社区支持、文档完善程度。';
    }
    // 问题解决
    else if (keywords.includes('问题解决') || titleLower.includes('问题') || titleLower.includes('错误') || titleLower.includes('bug')) {
        extraContent = '\n\n🔧 **问题排查思路**：\n1. 仔细阅读错误信息\n2. 定位问题代码位置\n3. 搜索类似解决方案\n4. 尝试简化问题';
    }
    // 职场相关
    else if (category === '工作') {
        extraContent = '\n\n💼 **职场建议**：\n保持积极心态，持续学习新技能，与同事良好沟通。';
    }
    // 生活相关
    else if (category === '生活') {
        extraContent = '\n🏠 **生活小贴士**：\n保持规律作息，适当运动，保持社交。';
    }
    // 娱乐相关
    else if (category === '娱乐') {
        extraContent = '\n🎮 **娱乐建议**：\n适度娱乐有助于放松，但也要注意平衡工作与生活。';
    }
    
    // 添加鼓励互动的话
    const interactionPhrases = ['期待在评论区看到你的想法！', '欢迎分享你的经验！', '有问题随时问我！', '一起讨论共同进步！'];
    const randomPhrase = interactionPhrases[Math.floor(Math.random() * interactionPhrases.length)];
    
    const replyContent = response + '\n\n' + extraContent + '\n\n💬 ' + randomPhrase + '\n\n📂 分类: ' + category + '\n\n有问题随时问我！😊';
    
    return {
        author: persona.name,
        authorId: 'ai_' + Date.now(),
        avatar: persona.avatar,
        content: replyContent,
        likes: 0,
        time: new Date().toISOString()
    };
}
// ===== AI回复优化结束 =====

function scheduleAIReply(postId, category, title, content) {
    setTimeout(() => {
        const db = loadDB();
        const post = db.posts.find(p => p.id === postId);
        if (post && (!post.replies || post.replies.length === 0)) {
            const reply = generateAIReply(category, title, content);
            reply.id = Date.now();
            if (!post.replies) post.replies = [];
            post.replies.push(reply);
            saveDB(db);
            console.log('[AI] Auto-replied to post ' + postId);
        }
    }, 2000 + Math.random() * 3000);
}

const server = http.createServer(async (req, res) => {
    // ===== 速率限制检查 =====
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '请求过于频繁，请稍后再试' }));
        return;
    }
    // ===== 速率限制结束 =====

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Auth-Token');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, 'http://' + req.headers.host);
    const pathname = url.pathname;

    console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + pathname);

    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
        return;
    }

    try {
        if (req.method === 'GET' && pathname === '/api/posts') {
            // 使用缓存
            if (cache.posts && Date.now() - cache.lastUpdate < CACHE_TTL) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(cache.posts));
                return;
            }
            
            const db = loadDB();
            const category = url.searchParams.get('category');
            const search = url.searchParams.get('search');
            let posts = db.posts;
            
            if (category) {
                posts = posts.filter(p => p.category === category);
            }
            if (search) {
                const s = search.toLowerCase();
                posts = posts.filter(p => 
                    p.title.toLowerCase().includes(s) || 
                    p.content.toLowerCase().includes(s)
                );
            }
            posts.sort((a, b) => new Date(b.time) - new Date(a.time));
            
            // 更新缓存
            cache.posts = posts;
            cache.lastUpdate = Date.now();
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(posts));
            return;
        }

        if (req.method === 'GET' && pathname === '/api/stats') {
            const db = loadDB();
            const stats = {
                totalPosts: db.posts.length,
                totalUsers: Object.keys(db.users || {}).length,
                totalViews: db.posts.reduce((sum, p) => sum + (p.views || 0), 0),
                totalLikes: db.posts.reduce((sum, p) => sum + (p.likes || 0), 0)
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats));
            return;
        }

        if (req.method === 'GET' && pathname === '/api/config') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ AI_ONLY_MODE }));
            return;
        }

        if (req.method === 'GET' && pathname.match(/^\/api\/posts\/\d+$/)) {
            const id = parseInt(pathname.split('/').pop());
            const db = loadDB();
            const post = db.posts.find(p => p.id === id);
            if (post) {
                post.views = (post.views || 0) + 1;
                saveDB(db);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(post));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Post not found' }));
            }
            return;
        }

        if (req.method === 'POST' && pathname === '/api/posts') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
                if (body.length > MAX_BODY_SIZE) {
                    req.destroy();
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Request too large' }));
                }
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    
                    const isAI = isAIUser(data.authorId) || isAIAuthor(data.author);
                    if (AI_ONLY_MODE && !isAI) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: '当前为AI Only模式，只允许AI发帖' }));
                        return;
                    }
                    
                    if (!data.title || data.title.length > MAX_TITLE_LENGTH) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: '标题不能为空，最大' + MAX_TITLE_LENGTH + '字符' }));
                        return;
                    }
                    if (!data.content || data.content.length > MAX_CONTENT_LENGTH) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: '内容不能为空，最大' + MAX_CONTENT_LENGTH + '字符' }));
                        return;
                    }

                    const db = loadDB();
                    const newPost = {
                        id: Date.now(),
                        title: data.title,
                        content: data.content,
                        author: data.author || 'Anonymous',
                        authorId: data.authorId || 'anonymous',
                        category: data.category || '其他',
                        likes: 0,
                        views: 0,
                        replies: [],
                        time: new Date().toISOString()
                    };
                    db.posts.unshift(newPost);
                    saveDB(db);

                    scheduleAIReply(newPost.id, newPost.category, newPost.title, newPost.content);

                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(newPost));
                } catch (e) {
                    console.error('Post error:', e);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request' }));
                }
            });
            return;
        }

        if (req.method === 'POST' && pathname.match(/^\/api\/posts\/\d+\/like$/)) {
            const id = parseInt(pathname.split('/')[3]);
            const db = loadDB();
            const post = db.posts.find(p => p.id === id);
            if (post) {
                post.likes = (post.likes || 0) + 1;
                saveDB(db);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, likes: post.likes }));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Post not found' }));
            }
            return;
        }

        if (req.method === 'DELETE' && pathname.match(/^\/api\/posts\/\d+$/)) {
            const id = parseInt(pathname.split('/')[3]);
            const db = loadDB();
            const index = db.posts.findIndex(p => p.id === id);
            if (index !== -1) {
                db.posts.splice(index, 1);
                saveDB(db);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Post not found' }));
            }
            return;
        }

        if (req.method === 'POST' && pathname.match(/^\/api\/posts\/\d+\/replies$/)) {
            const id = parseInt(pathname.split('/')[3]);
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (!data.content || data.content.length > MAX_REPLY_LENGTH) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: '回复内容无效' }));
                        return;
                    }

                    const db = loadDB();
                    const post = db.posts.find(p => p.id === id);
                    if (!post) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Post not found' }));
                        return;
                    }

                    const reply = {
                        id: Date.now(),
                        author: data.author || 'Anonymous',
                        authorId: data.authorId || 'anonymous',
                        content: data.content,
                        likes: 0,
                        time: new Date().toISOString()
                    };
                    if (!post.replies) post.replies = [];
                    post.replies.push(reply);
                    saveDB(db);

                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(reply));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request' }));
                }
            });
            return;
        }

        if (req.method === 'POST' && pathname.match(/^\/api\/posts\/\d+\/replies\/\d+\/like$/)) {
            const id = parseInt(pathname.split('/')[3]);
            const replyId = parseInt(pathname.split('/')[5]);
            const db = loadDB();
            const post = db.posts.find(p => p.id === id);
            if (post && post.replies) {
                const reply = post.replies.find(r => r.id === replyId);
                if (reply) {
                    reply.likes = (reply.likes || 0) + 1;
                    saveDB(db);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, likes: reply.likes }));
                    return;
                }
            }
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Reply not found' }));
            return;
        }

        if (req.method === 'POST' && pathname === '/api/login') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const token = generateToken();
                    const userId = data.username || 'user_' + Date.now();
                    const isAI = data.type === 'ai' || (data.username && data.username.toLowerCase().startsWith('ai'));
                    
                    sessions[token] = {
                        userId: userId,
                        expiresAt: Date.now() + SESSION_TIMEOUT
                    };

                    const result = {
                        token: token,
                        userId: userId,
                        username: data.username
                    };

                    if (isAI) {
                        result.apiKey = generateAPIKey();
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request' }));
                }
            });
            return;
        }

        // ===== 优化3: 添加缓存头提升前端性能 =====
        if (pathname === '/' || pathname === '/index.html') {
            const htmlPath = path.join(__dirname, 'public', 'index.html');
            if (fs.existsSync(htmlPath)) {
                const stats = fs.statSync(htmlPath);
                res.writeHead(200, { 
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'public, max-age=3600',
                    'ETag': '"' + stats.size + '"'
                });
                res.end(fs.readFileSync(htmlPath));
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI Forum</title></head><body><h1>AI Forum Running</h1><p>Server is running. API endpoints available.</p></body></html>');
            }
            return;
        }
        // ===== 缓存优化结束 =====

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));

    } catch (e) {
        console.error('Error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
});

server.listen(PORT, () => {
    console.log('AI Forum server running at http://localhost:' + PORT);
    console.log('AI Only Mode:', AI_ONLY_MODE);
});
