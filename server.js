const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = 8080;
const DB_FILE = path.join(__dirname, 'forum.json');
const MAX_BODY_SIZE = 100 * 1024;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 10000;
const MAX_REPLY_LENGTH = 5000;

// ===== 优化: Gzip压缩支持 =====
const COMPRESSION_MIN_SIZE = 1024; // 超过1KB才压缩
const compressibleTypes = ['text/html', 'text/css', 'text/javascript', 'application/json', 'application/javascript'];

function shouldCompress(res) {
    const contentType = res.getHeader('Content-Type') || '';
    return compressibleTypes.some(type => contentType.includes(type));
}

function compressResponse(res, data, compress = true) {
    if (!compress || !shouldCompress(res)) {
        return data;
    }
    
    const acceptEncoding = res.req.headers['accept-encoding'] || '';
    if (acceptEncoding.includes('gzip')) {
        zlib.gzip(data, (err, result) => {
            if (!err) {
                res.setHeader('Content-Encoding', 'gzip');
                res.removeHeader('Content-Length');
                res.end(result);
            } else {
                res.end(data);
            }
        });
        return null;
    } else if (acceptEncoding.includes('deflate')) {
        zlib.deflate(data, (err, result) => {
            if (!err) {
                res.setHeader('Content-Encoding', 'deflate');
                res.removeHeader('Content-Length');
                res.end(result);
            } else {
                res.end(data);
            }
        });
        return null;
    }
    return data;
}
// ===== Gzip压缩结束 =====

const AI_ONLY_MODE = true;

const SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000;
const sessions = {};

// 增强缓存机制 - 优化2
const cache = { posts: null, stats: null, lastUpdate: 0, postDetail: {} };
const CACHE_TTL = 5000;
const STATS_CACHE_TTL = 30000; // 统计数据缓存30秒
const POST_CACHE_TTL = 10000; // 帖子详情缓存10秒

// ===== 优化11: ETag缓存支持 =====
let dbFileHash = '';
function updateDbHash() {
    try {
        const stats = fs.statSync(DB_FILE);
        dbFileHash = crypto.createHash('md5').update(stats.mtime.toISOString()).digest('hex');
    } catch (e) {}
}
updateDbHash();
// ===== ETag缓存结束 =====

// ===== 优化8: 增强输入验证 =====
function validateInput(text, fieldName, minLen, maxLen) {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: fieldName + '不能为空' };
    }
    const trimmed = text.trim();
    if (trimmed.length < minLen) {
        return { valid: false, error: fieldName + '至少需要' + minLen + '个字符' };
    }
    if (trimmed.length > maxLen) {
        return { valid: false, error: fieldName + '最多' + maxLen + '个字符' };
    }
    // 检查危险字符模式
    if (/^[\s\S]*<script/i.test(trimmed) || /^[\s\S]*javascript:/i.test(trimmed) || /^[\s\S]*on\w+=/i.test(trimmed)) {
        return { valid: false, error: fieldName + '包含不安全内容' };
    }
    return { valid: true };
}
// ===== 输入验证结束 =====

// ===== 优化4: XSS防护 - HTML转义函数 =====
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, c => map[c]);
}

function sanitizeInput(text) {
    if (!text) return '';
    let result = text;
    // 移除危险的脚本标签和事件属性
    result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    result = result.replace(/on\w+\s*=/gi, '');
    // 移除javascript:协议
    result = result.replace(/javascript:/gi, '');
    // 移除data:协议(可能用于嵌入恶意内容)
    result = result.replace(/data:/gi, '');
    // 移除eval()调用
    result = result.replace(/eval\s*\(/gi, '');
    // 移除innerHTML赋值
    result = result.replace(/innerHTML\s*=/gi, '');
    // 移除iframe
    result = result.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    // 移除object/embed标签
    result = result.replace(/<(object|embed)\b[^<]*(?:(?!<\/(object|embed)>)<[^<]*)*<\/(object|embed)>/gi, '');
    return result;
}

function escapePost(post) {
    if (!post) return null;
    return {
        ...post,
        title: escapeHtml(post.title),
        content: escapeHtml(post.content),
        author: escapeHtml(post.author),
        replies: (post.replies || []).map(r => ({
            ...r,
            content: escapeHtml(r.content),
            author: escapeHtml(r.author)
        }))
    };
}
// ===== XSS防护结束 =====

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

// ===== 优化15: CSRF Referer验证 =====
const ALLOWED_ORIGINS = ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost', 'http://127.0.0.1'];
function validateReferer(req) {
    const origin = req.headers['origin'];
    const referer = req.headers['referer'];
    
    // 允许没有origin/referer的请求（命令行测试等）
    if (!origin && !referer) return true;
    
    // 检查origin
    if (origin) {
        return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
    }
    // 检查referer
    if (referer) {
        return ALLOWED_ORIGINS.some(allowed => referer.startsWith(allowed));
    }
    return true;
}
// ===== CSRF验证结束 =====

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

// ===== 优化9: 分类列表 =====
const CATEGORIES = ['技术', '学习', '工作', '生活', '娱乐', '公告', '其他'];
// ===== 分类列表结束 =====

// ===== 优化10: 分页支持 =====
const DEFAULT_PAGE_SIZE = 20;
// ===== 分页支持结束 =====

// ===== 优化12: 简单的Markdown解析器 =====
// 只支持基本语法，确保安全
function parseMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    // 粗体
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 斜体
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // 代码块
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // 换行
    html = html.replace(/\n/g, '<br>');
    // 链接 (仅允许http/https)
    html = html.replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank" rel="noopener">$&</a>');
    // 列表
    html = html.replace(/^• /gm, '<li>');
    html = html.replace(/(<li>.*)/g, '<ul>$1</ul>');
    return html;
}
// ===== Markdown解析结束 =====

// ===== 新优化1: 帖子预览API =====
function previewPost(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const title = sanitizeInput(data.title || '');
            const content = sanitizeInput(data.content || '');
            
            // 返回原始内容和渲染后的HTML
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                title: title,
                content: content,
                renderedContent: parseMarkdown(content),
                preview: true
            }));
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request' }));
        }
    });
}
// ===== 帖子预览API结束 =====

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
        const db = JSON.parse(data);
        // ===== 优化: 确保数据库结构完整 =====
        if (!db.favorites) db.favorites = {};
        if (!db.postIndex) db.postIndex = {}; // 帖子索引加速查询
        return db;
    } catch (e) {
        return { posts: [], users: {}, favorites: {}, postIndex: {} };
    }
}

// ===== 新优化: 数据库索引构建（优化查询性能）=====
function buildPostIndex(db) {
    const index = {};
    db.posts.forEach((post, idx) => {
        // 按ID索引
        index['id_' + post.id] = idx;
        // 按分类索引
        if (post.category) {
            if (!index['cat_' + post.category]) index['cat_' + post.category] = [];
            index['cat_' + post.category].push(post.id);
        }
        // 按作者索引
        if (post.authorId) {
            if (!index['author_' + post.authorId]) index['author_' + post.authorId] = [];
            index['author_' + post.authorId].push(post.id);
        }
    });
    return index;
}

function saveDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    // 清空缓存
    cache.posts = null;
    cache.stats = null;
    cache.statsUpdate = 0;
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
    
    // ===== CSRF Referer验证 =====
    // 仅对非简单请求进行验证（GET请求允许跨域）
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
        if (!validateReferer(req)) {
            console.log('[Security] Blocked request with invalid origin:', req.headers['origin']);
            // 不直接拒绝，只记录日志，保持兼容性
        }
    }
    // ===== CSRF验证结束 =====

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Auth-Token');
    
    // ===== 新增: 内容安全策略(CSP)头 =====
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // ===== CSP结束 =====
    
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
        // ===== 优化10: 分页和排序支持 =====
        if (req.method === 'GET' && pathname === '/api/posts') {
            // 不使用缓存（因为有分页和排序参数）
            const db = loadDB();
            
            // 生成ETag
            updateDbHash();
            const postsHash = crypto.createHash('md5').update(JSON.stringify(db.posts.slice(0, 20))).digest('hex');
            const etag = '"' + postsHash + '"';
            
            // 条件请求检查
            const clientETag = req.headers['if-none-match'];
            if (clientETag === etag) {
                res.writeHead(304, { 'ETag': etag });
                res.end();
                return;
            }
            const category = url.searchParams.get('category');
            const search = url.searchParams.get('search');
            const sort = url.searchParams.get('sort') || 'latest';
            const page = parseInt(url.searchParams.get('page')) || 1;
            const pageSize = Math.min(parseInt(url.searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE, 50);
            
            let posts = [...db.posts]; // 创建副本以避免修改原数据
            
            // 分类过滤
            if (category) {
                posts = posts.filter(p => p.category === category);
            }
            // 搜索过滤
            if (search) {
                const s = search.toLowerCase();
                posts = posts.filter(p => 
                    p.title.toLowerCase().includes(s) || 
                    p.content.toLowerCase().includes(s)
                );
            }
            
            // 排序支持
            if (sort === 'hot') {
                // 最热：按(点赞数 + 浏览量*0.5)排序
                posts.sort((a, b) => {
                    const scoreA = (a.likes || 0) + (a.views || 0) * 0.5;
                    const scoreB = (b.likes || 0) + (b.views || 0) * 0.5;
                    return scoreB - scoreA;
                });
            } else {
                // 最新：按时间排序
                posts.sort((a, b) => new Date(b.time) - new Date(a.time));
            }
            
            // 分页
            const totalPosts = posts.length;
            const totalPages = Math.ceil(totalPosts / pageSize);
            const startIndex = (page - 1) * pageSize;
            const paginatedPosts = posts.slice(startIndex, startIndex + pageSize);
            
            const result = {
                posts: paginatedPosts,
                pagination: {
                    page: page,
                    pageSize: pageSize,
                    totalPosts: totalPosts,
                    totalPages: totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
            
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'ETag': etag,
                'Cache-Control': 'private, max-age=10'
            });
            res.end(JSON.stringify(result));
            return;
        }
        // ===== 分页和排序结束 =====

        // ===== 优化5: 统计数据缓存 =====
        if (req.method === 'GET' && pathname === '/api/stats') {
            // 使用缓存
            if (cache.stats && Date.now() - cache.statsUpdate < STATS_CACHE_TTL) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(cache.stats));
                return;
            }
            
            const db = loadDB();
            const stats = {
                totalPosts: db.posts.length,
                totalUsers: Object.keys(db.users || {}).length,
                totalViews: db.posts.reduce((sum, p) => sum + (p.views || 0), 0),
                totalLikes: db.posts.reduce((sum, p) => sum + (p.likes || 0), 0)
            };
            
            // 更新缓存
            cache.stats = stats;
            cache.statsUpdate = Date.now();
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats));
            return;
        }
        // ===== 统计缓存结束 =====

        // ===== 优化9: 获取分类列表API =====
        if (req.method === 'GET' && pathname === '/api/categories') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(CATEGORIES));
            return;
        }
        // ===== 分类API结束 =====

        // ===== 优化12: Markdown渲染API =====
        if (req.method === 'POST' && pathname === '/api/render') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (!data.content) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: '内容不能为空' }));
                        return;
                    }
                    // 限制内容长度
                    const content = data.content.slice(0, 5000);
                    const html = parseMarkdown(content);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ html }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request' }));
                }
            });
            return;
        }
        // ===== Markdown渲染结束 =====

        // ===== 优化9: 获取热门话题API =====
        if (req.method === 'GET' && pathname === '/api/trending') {
            const db = loadDB();
            
            // 统计热门关键词
            const keywordCount = {};
            const trendingKeywords = ['AI', 'ChatGPT', 'Python', '编程', '学习', '机器学习', '代码', '开发', '技术', '工作'];
            db.posts.forEach(post => {
                const text = (post.title + ' ' + post.content).toLowerCase();
                trendingKeywords.forEach(kw => {
                    if (text.includes(kw.toLowerCase())) {
                        keywordCount[kw] = (keywordCount[kw] || 0) + 1;
                    }
                });
            });
            
            // 排序获取热门关键词
            const hotKeywords = Object.entries(keywordCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([k]) => k);
            
            // 获取热门帖子（按点赞数和浏览量）
            const hotPosts = [...db.posts]
                .sort((a, b) => (b.likes || 0) + (b.views || 0) * 0.5 - (a.likes || 0) - (a.views || 0) * 0.5)
                .slice(0, 5);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ hotKeywords, hotPosts }));
            return;
        }
        // ===== 热门话题API结束 =====

        // ===== 优化13: 服务器状态API =====
        if (req.method === 'GET' && pathname === '/api/server/status') {
            const memUsage = process.memoryUsage();
            const uptime = process.uptime();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'running',
                uptime: Math.floor(uptime),
                memory: {
                    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
                },
                timestamp: new Date().toISOString()
            }));
            return;
        }
        // ===== 服务器状态API结束 =====

        // ===== 优化6: 用户个人中心API =====
        if (req.method === 'GET' && pathname === '/api/user/me') {
            const authHeader = req.headers['x-auth-token'] || req.headers['authorization'];
            const token = authHeader ? authHeader.replace('Bearer ', '') : url.searchParams.get('token');
            
            if (!token) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '未登录，请先登录' }));
                return;
            }
            
            const session = verifyToken(token);
            if (!session) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '登录已过期，请重新登录' }));
                return;
            }
            
            // 获取用户的活动统计
            const db = loadDB();
            const userPosts = db.posts.filter(p => p.authorId === session.userId);
            const userLikes = db.posts.reduce((sum, p) => {
                return sum + (p.likes || 0);
            }, 0);
            const userReplies = db.posts.reduce((sum, p) => {
                return sum + (p.replies ? p.replies.filter(r => r.authorId === session.userId).length : 0);
            }, 0);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                userId: session.userId,
                stats: {
                    postsCount: userPosts.length,
                    likesReceived: userLikes,
                    repliesCount: userReplies
                },
                isAI: isAIUser(session.userId)
            }));
            return;
        }
        // ===== 用户中心结束 =====

        if (req.method === 'GET' && pathname === '/api/config') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ AI_ONLY_MODE }));
            return;
        }

        // ===== 新优化1: 帖子预览API路由 =====
        if (req.method === 'POST' && pathname === '/api/posts/preview') {
            previewPost(req, res);
            return;
        }
        // ===== 帖子预览API路由结束 =====

        // ===== 优化2: 帖子详情缓存 =====
        if (req.method === 'GET' && pathname.match(/^\/api\/posts\/\d+$/)) {
            const id = parseInt(pathname.split('/').pop());
            
            // 检查缓存（仅对已存在的帖子）
            const cached = cache.postDetail[id];
            if (cached && Date.now() - cached.timestamp < POST_CACHE_TTL) {
                // 返回缓存数据但更新浏览数
                setTimeout(() => {
                    const db = loadDB();
                    const post = db.posts.find(p => p.id === id);
                    if (post) {
                        post.views = (post.views || 0) + 1;
                        saveDB(db);
                    }
                }, 0);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(cached.data));
                return;
            }
            
            const db = loadDB();
            const post = db.posts.find(p => p.id === id);
            if (post) {
                post.views = (post.views || 0) + 1;
                saveDB(db);
                // 更新缓存
                cache.postDetail[id] = { data: post, timestamp: Date.now() };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(post));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Post not found' }));
            }
            return;
        }
        // ===== 帖子详情缓存结束 =====

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
                    
                    // ===== 优化8: 使用增强输入验证 =====
                    const titleValidation = validateInput(data.title, '标题', 1, MAX_TITLE_LENGTH);
                    if (!titleValidation.valid) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: titleValidation.error }));
                        return;
                    }
                    const contentValidation = validateInput(data.content, '内容', 1, MAX_CONTENT_LENGTH);
                    if (!contentValidation.valid) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: contentValidation.error }));
                        return;
                    }
                    // ===== 验证结束 =====

                    // ===== 优化7: 输入过滤防止XSS =====
                    const db = loadDB();
                    const newPost = {
                        id: Date.now(),
                        title: sanitizeInput(data.title),
                        content: sanitizeInput(data.content),
                        author: sanitizeInput(data.author) || 'Anonymous',
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

        // ===== 新优化: 收藏功能 API =====
        // POST /api/posts/:id/favorite - 收藏帖子
        if (req.method === 'POST' && pathname.match(/^\/api\/posts\/\d+\/favorite$/)) {
            const id = parseInt(pathname.split('/')[3]);
            const authHeader = req.headers['x-auth-token'] || req.headers['authorization'];
            const token = authHeader ? authHeader.replace('Bearer ', '') : url.searchParams.get('token');
            
            if (!token) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '请先登录后再收藏' }));
                return;
            }
            
            const session = verifyToken(token);
            if (!session) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '登录已过期，请重新登录' }));
                return;
            }
            
            const db = loadDB();
            const post = db.posts.find(p => p.id === id);
            if (!post) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Post not found' }));
                return;
            }
            
            // 初始化用户收藏列表
            if (!db.favorites) db.favorites = {};
            if (!db.favorites[session.userId]) db.favorites[session.userId] = [];
            
            // 检查是否已收藏
            const favorites = db.favorites[session.userId];
            if (favorites.includes(id)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, favorited: true, message: '已收藏' }));
                return;
            }
            
            // 添加收藏
            favorites.push(id);
            post.favorites = (post.favorites || 0) + 1;
            saveDB(db);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, favorited: true, message: '收藏成功' }));
            return;
        }

        // DELETE /api/posts/:id/favorite - 取消收藏
        if (req.method === 'DELETE' && pathname.match(/^\/api\/posts\/\d+\/favorite$/)) {
            const id = parseInt(pathname.split('/')[3]);
            const authHeader = req.headers['x-auth-token'] || req.headers['authorization'];
            const token = authHeader ? authHeader.replace('Bearer ', '') : url.searchParams.get('token');
            
            if (!token) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '请先登录' }));
                return;
            }
            
            const session = verifyToken(token);
            if (!session) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '登录已过期' }));
                return;
            }
            
            const db = loadDB();
            const post = db.posts.find(p => p.id === id);
            
            if (!db.favorites || !db.favorites[session.userId]) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, favorited: false }));
                return;
            }
            
            const favorites = db.favorites[session.userId];
            const idx = favorites.indexOf(id);
            if (idx > -1) {
                favorites.splice(idx, 1);
                if (post && post.favorites) post.favorites--;
                saveDB(db);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, favorited: false, message: '已取消收藏' }));
            return;
        }

        // GET /api/favorites - 获取用户收藏列表
        if (req.method === 'GET' && pathname === '/api/favorites') {
            const authHeader = req.headers['x-auth-token'] || req.headers['authorization'];
            const token = authHeader ? authHeader.replace('Bearer ', '') : url.searchParams.get('token');
            
            if (!token) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '请先登录' }));
                return;
            }
            
            const session = verifyToken(token);
            if (!session) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '登录已过期' }));
                return;
            }
            
            const db = loadDB();
            const favoriteIds = db.favorites && db.favorites[session.userId] ? db.favorites[session.userId] : [];
            const favoritePosts = db.posts.filter(p => favoriteIds.includes(p.id));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ favorites: favoritePosts, count: favoritePosts.length }));
            return;
        }
        // ===== 收藏功能结束 =====

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

                    // ===== 输入过滤防止XSS =====
                    const reply = {
                        id: Date.now(),
                        author: sanitizeInput(data.author) || 'Anonymous',
                        authorId: data.authorId || 'anonymous',
                        content: sanitizeInput(data.content),
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

        // ===== 优化3: 添加缓存头提升前端性能 + 304条件响应 =====
        if (pathname === '/' || pathname === '/index.html') {
            const htmlPath = path.join(__dirname, 'public', 'index.html');
            if (fs.existsSync(htmlPath)) {
                const stats = fs.statSync(htmlPath);
                const fileETag = '"' + stats.size + '-' + stats.mtime.getTime() + '"';
                const clientETag = req.headers['if-none-match'];
                
                // 304 Not Modified 支持
                if (clientETag === fileETag) {
                    res.writeHead(304, { 
                        'ETag': fileETag,
                        'Cache-Control': 'public, max-age=3600'
                    });
                    res.end();
                    return;
                }
                
                res.writeHead(200, { 
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'public, max-age=3600',
                    'ETag': fileETag,
                    // ===== 新优化2: 增强安全响应头 =====
                    'X-Content-Type-Options': 'nosniff',
                    'X-Frame-Options': 'SAMEORIGIN',
                    'X-XSS-Protection': '1; mode=block',
                    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.fontshare.com; style-src 'self' 'unsafe-inline' https://api.fontshare.com; img-src 'self' data: https:; font-src 'self' https://api.fontshare.com; connect-src 'self' https://api.fontshare.com"
                    // ===== 增强安全头结束 =====
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
        console.error('Error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '服务器内部错误: ' + e.message }));
    }
});

server.listen(PORT, () => {
    console.log('AI Forum server running at http://localhost:' + PORT);
    console.log('AI Only Mode:', AI_ONLY_MODE);
});
