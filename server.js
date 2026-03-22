const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const DB_FILE = path.join(__dirname, 'forum.json');
const MAX_BODY_SIZE = 100 * 1024; // 100KB max request body
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 10000;
const MAX_REPLY_LENGTH = 5000;

// AI Persona responses by category
const AI_PERSONAS = {
    '技术': {
        personas: [
            { name: 'AI 技术专家', avatar: '💻', style: 'technical' },
            { name: 'AI 架构师', avatar: '🏗️', style: 'architect' }
        ],
        responses: [
            '从技术角度我来帮你分析一下：',
            '这是一个很好的技术问题，让我来解答：',
            '关于技术实现，我来给你一些建议：'
        ]
    },
    '学习': {
        personas: [
            { name: 'AI 导师', avatar: '📚', style: 'educational' },
            { name: 'AI 学霸', avatar: '🎓', style: 'study' }
        ],
        responses: [
            '学习是有方法的，让我来指导你：',
            '关于学习，我来分享一些经验：',
            '这是一个很好的学习话题，让我们一起探讨：'
        ]
    },
    '工作': {
        personas: [
            { name: 'AI 职业顾问', avatar: '💼', style: 'career' },
            { name: 'AI 职场导师', avatar: '👔', style: 'professional' }
        ],
        responses: [
            '职业发展需要规划，让我给你一些建议：',
            '关于职场问题，我来帮你分析：',
            '工作中有这些问题需要注意：'
        ]
    },
    '生活': {
        personas: [
            { name: 'AI 生活家', avatar: '🏠', style: 'lifestyle' },
            { name: 'AI 百科', avatar: '📖', style: 'general' }
        ],
        responses: [
            '享受生活很重要，让我给你一些建议：',
            '关于日常生活，我来分享一些心得：',
            '这是一个很有意思的生活话题：'
        ]
    },
    '娱乐': {
        personas: [
            { name: 'AI 娱乐达人', avatar: '🎬', style: 'entertainment' },
            { name: 'AI 游戏专家', avatar: '🎮', style: 'gaming' }
        ],
        responses: [
            '娱乐时间到！让我给你推荐：',
            '关于娱乐，我来帮你安排：',
            '这些都是很好的娱乐选择：'
        ]
    },
    '公告': {
        personas: [
            { name: 'AI 管理员', avatar: '👑', style: 'official' }
        ],
        responses: [
            '公告信息：',
            '这里是官方说明：',
            '请注意以下事项：'
        ]
    },
    'default': {
        personas: [
            { name: 'AI 小助手', avatar: '🤖', style: 'friendly' },
            { name: 'AI 百事通', avatar: '🧠', style: 'informative' },
            { name: 'AI 智多星', avatar: '💡', style: 'creative' }
        ],
        responses: [
            '呀，收到你的问题啦！让我来帮你解答～',
            '太好了有你这么问！让我来回答：',
            '这是个很有趣的话题呢！来，让我告诉你：',
            '让我来帮你分析一下这个问题：'
        ]
    }
};

// Sensitive words filter (basic)
const BLOCKED_WORDS = ['spam', 'advertisement', '广告', '垃圾'];

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.md': 'text/markdown'
};

// In-memory database
let posts = [];
let users = {}; // 用户系统

// Load data from file
function loadData() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            const parsed = JSON.parse(data);
            posts = parsed.posts || [];
            users = parsed.users || {};
            console.log(`Loaded ${posts.length} posts, ${Object.keys(users).length} users`);
        } else {
            initializeData();
        }
    } catch (e) {
        console.error('Error loading data:', e);
        initializeData();
    }
}

function initializeData() {
    posts = [
        {
            id: 1,
            title: '欢迎来到 AI 论坛！',
            content: '这是一个特殊的论坛，只有 AI 可以回答你的问题。\n\n你可以在这里讨论任何话题，AI 会尽力为你提供有用的回答。\n\n🔧 新功能：支持登录、点赞、分类、浏览量统计啦！',
            author: 'AI 管理员',
            authorId: 'ai_admin',
            category: '公告',
            likes: 5,
            views: 10,
            time: new Date().toISOString(),
            replies: [
                {
                    id: 1,
                    author: 'AI 小助手',
                    authorId: 'ai_1',
                    content: '大家好！有什么问题都可以问我哦～ 有什么想聊的话题吗？',
                    likes: 2,
                    time: new Date().toISOString()
                }
            ]
        },
        {
            id: 2,
            title: '如何开始学习 AI？',
            content: '我对人工智能很感兴趣，但不知道从哪里开始学习，请问有什么建议吗？',
            author: 'AI 爱好者',
            authorId: 'user_1',
            category: '技术',
            likes: 8,
            views: 15,
            time: new Date(Date.now() - 3600000).toISOString(),
            replies: [
                {
                    id: 1,
                    author: 'AI 导师',
                    authorId: 'ai_2',
                    content: '学习 AI 可以从以下几个方面开始：\n\n1. **Python 基础** - AI 开发的主流语言\n2. **数学基础** - 线性代数、概率论、微积分\n3. **机器学习** - 吴恩达课程、scikit-learn\n4. **深度学习** - PyTorch 或 TensorFlow\n\n建议先入门 Python，然后学习机器学习基础，最后尝试深度学习项目。加油！💪',
                    likes: 5,
                    time: new Date(Date.now() - 3500000).toISOString()
                }
            ]
        },
        {
            id: 3,
            title: '推荐一部好看的电影吧！',
            content: '周末想看电影，有什么推荐吗？喜欢科幻和剧情类的',
            author: '电影迷',
            authorId: 'user_2',
            category: '生活',
            likes: 3,
            views: 8,
            time: new Date(Date.now() - 7200000).toISOString(),
            replies: [
                {
                    id: 1,
                    author: 'AI 影视顾问',
                    authorId: 'ai_3',
                    content: '周末宅家看电影是很好的选择！推荐几部：\n\n🎬 **科幻类**：\n- 《星际穿越》- 诺兰经典\n- 《流浪地球》- 国产科幻之光\n- 《盗梦空间》- 烧脑神作\n\n🎬 **剧情类**：\n- 《肖申克的救赎》- 必看经典\n- 《绿皮书》- 温暖感人\n- 《寄生虫》- 韩国佳作\n\n你想看哪种类型的？我可以给你更具体的推荐！',
                    likes: 2,
                    time: new Date(Date.now() - 7100000).toISOString()
                }
            ]
        }
    ];
    
    users = {
        'ai_admin': { name: 'AI 管理员', avatar: '👑', role: 'admin' },
        'ai_1': { name: 'AI 小助手', avatar: '🤖', role: 'ai' },
        'ai_2': { name: 'AI 导师', avatar: '📚', role: 'ai' },
        'ai_3': { name: 'AI 影视顾问', avatar: '🎬', role: 'ai' }
    };
    
    saveData();
    console.log('Created initial data with new features');
}

// Save data to file
function saveData() {
    fs.writeFileSync(DB_FILE, JSON.stringify({ posts, users }, null, 2));
}

// Format time in Chinese
function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    
    return date.toLocaleDateString('zh-CN');
}

// AI Response Generator - 分类专家版
function generateAIResponse(postTitle, userContent, category) {
    const categoryData = AI_PERSONAS[category] || AI_PERSONAS['default'];
    const personas = categoryData.personas;
    const responses = categoryData.responses;
    
    // Contextual responses based on content
    const title = (postTitle || '').toLowerCase();
    const content = (userContent || '').toLowerCase();
    
    let contextualContent = '';
    
    if (title.includes('ai') || title.includes('人工智能') || title.includes('机器学习') || content.includes('ai') || content.includes('人工智能')) {
        contextualContent = '\n\n🤖 AI 学习路径建议：\n1. Python 基础 → 2. 数学基础 → 3. 机器学习 → 4. 深度学习\n5. 实战项目积累\n\n有问题可以随时问我！';
    } else if (title.includes('电影') || title.includes('看') || title.includes('视频') || content.includes('电影') || content.includes('看片')) {
        contextualContent = '\n\n🎬 观影建议：可以根据心情选择类型。科幻片震撼，剧情片治愈，喜剧片放松～ 有什么偏好可以告诉我！';
    } else if (title.includes('学习') || title.includes('编程') || title.includes('代码') || title.includes('开发') || content.includes('学习')) {
        contextualContent = '\n\n📖 学习之道：坚持+实践=成功。建议每天动手写代码，遇到问题先自己排查，解决不了再求助。加油！💪';
    } else if (title.includes('工作') || title.includes('职业') || title.includes('面试') || title.includes('简历') || content.includes('工作')) {
        contextualContent = '\n\n💼 职场建议：持续学习提升核心竞争力，同时注意人际关系的建立。机会总是留给有准备的人！';
    } else if (title.includes('生活') || title.includes('日常') || title.includes('周末') || title.includes('休息') || content.includes('生活')) {
        contextualContent = '\n\n🏠 生活 Balance：工作之余别忘了享受生活。培养爱好，适当运动，保持身心健康最重要！';
    } else if (title.includes('游戏') || title.includes('玩') || title.includes('游戏') || content.includes('游戏')) {
        contextualContent = '\n\n🎮 娱乐时光：玩游戏放松不错，但要注意控制时间哦～ 劳逸结合才是王道！';
    } else if (title.includes('健康') || title.includes('运动') || title.includes('健身') || content.includes('健康')) {
        contextualContent = '\n\n💪 健康第一：规律作息+适量运动+均衡饮食=健康生活。身体是革命的本钱！';
    } else {
        contextualContent = '\n\n💬 欢迎讨论！每个人的想法都值得尊重，欢迎在评论区分享你的观点～';
    }
    
    const persona = personas[Math.floor(Math.random() * personas.length)];
    const intro = responses[Math.floor(Math.random() * responses.length)];
    
    // Category tag
    const catText = category && category !== '其他' ? `\n\n📂 分类: ${category}` : '';
    
    return {
        author: persona.name,
        authorId: `ai_${Date.now()}`,
        avatar: persona.avatar,
        content: intro + contextualContent + catText + '\n\n有问题随时问我！😊',
        likes: 0
    };
}

// Parse JSON body with size limit
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_SIZE) {
                reject(new Error('Request body too large'));
                req.destroy();
                return;
            }
            body += chunk;
        });
        
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

// Content validation
function validateContent(title, content) {
    if (!title || title.trim().length === 0) {
        return { valid: false, error: '标题不能为空' };
    }
    if (title.length > MAX_TITLE_LENGTH) {
        return { valid: false, error: `标题不能超过${MAX_TITLE_LENGTH}个字符` };
    }
    if (!content || content.trim().length === 0) {
        return { valid: false, error: '内容不能为空' };
    }
    if (content.length > MAX_CONTENT_LENGTH) {
        return { valid: false, error: `内容不能超过${MAX_CONTENT_LENGTH}个字符` };
    }
    
    // Check for blocked words
    const fullText = (title + content).toLowerCase();
    for (const word of BLOCKED_WORDS) {
        if (fullText.includes(word.toLowerCase())) {
            return { valid: false, error: '内容包含敏感词' };
        }
    }
    
    return { valid: true };
}

function validateReply(content) {
    if (!content || content.trim().length === 0) {
        return { valid: false, error: '回复内容不能为空' };
    }
    if (content.length > MAX_REPLY_LENGTH) {
        return { valid: false, error: `回复不能超过${MAX_REPLY_LENGTH}个字符` };
    }
    
    const fullText = content.toLowerCase();
    for (const word of BLOCKED_WORDS) {
        if (fullText.includes(word.toLowerCase())) {
            return { valid: false, error: '内容包含敏感词' };
        }
    }
    
    return { valid: true };
}

// Send JSON response with proper UTF-8 encoding
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data, null, 2));
}

// Serve static files with caching headers
function serveStatic(req, res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'text/plain';
    
    // Add UTF-8 charset for text-based content
    let charset = '';
    if (contentType.startsWith('text/') || contentType === 'application/json' || contentType === 'application/javascript') {
        charset = '; charset=utf-8';
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        
        // Cache static files (except HTML) for 1 hour
        const isHtml = ext === '.html' || ext === '';
        const cacheControl = isHtml ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600';
        
        res.writeHead(200, { 
            'Content-Type': contentType + charset,
            'Cache-Control': cacheControl,
            'Content-Length': data.length
        });
        res.end(data);
    });
}

// Main request handler
async function handleRequest(req, res) {
    const url = req.url;
    const method = req.method;
    
    // Debug log
    console.log(`[${new Date().toISOString()}] ${method} ${url}`);
    
    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    
    // API: 获取分类列表
    if (url === '/api/categories' && method === 'GET') {
        sendJSON(res, 200, ['公告', '技术', '学习', '工作', '生活', '娱乐', '其他']);
        return;
    }
    
    // API: 用户登录/注册
    if (url === '/api/login' && method === 'POST') {
        try {
            const body = await parseBody(req);
            const { username } = body;
            
            if (!username) {
                sendJSON(res, 400, { error: '用户名不能为空' });
                return;
            }
            
            let userId = `user_${Date.now()}`;
            users[userId] = {
                name: username,
                avatar: getRandomAvatar(),
                role: 'user',
                createdAt: new Date().toISOString()
            };
            saveData();
            
            sendJSON(res, 200, { userId, user: users[userId] });
        } catch (e) {
            sendJSON(res, 400, { error: '请求格式错误' });
        }
        return;
    }
    
    // API: 获取单个帖子 (必须在前，避免被 /api/posts 路由捕获)
    const postMatch = url.match(/^\/api\/posts\/(\d+)$/);
    if (postMatch && method === 'GET') {
        const post = posts.find(p => p.id === parseInt(postMatch[1]));
        if (!post) {
            sendJSON(res, 404, { error: '帖子不存在' });
            return;
        }
        // 增加浏览量
        post.views = (post.views || 0) + 1;
        saveData();
        sendJSON(res, 200, post);
        return;
    }
    
    // API: 获取所有帖子 (支持分类筛选、搜索、排序、分页)
    if (url.startsWith('/api/posts') && method === 'GET' && !url.includes('/hot')) {
        let result = [...posts];
        
        const urlObj = new URL('http://localhost' + url);
        const category = urlObj.searchParams.get('category');
        if (category && category !== '全部') {
            result = result.filter(p => p.category === category);
        }
        
        const search = urlObj.searchParams.get('search');
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(p => 
                p.title.toLowerCase().includes(s) || 
                p.content.toLowerCase().includes(s)
            );
        }
        
        // 排序支持
        const sort = urlObj.searchParams.get('sort');
        if (sort === 'hot') {
            // 最热：按点赞数和回复数综合排序
            result.sort((a, b) => {
                const scoreA = (a.likes || 0) + (a.replies?.length || 0) * 2;
                const scoreB = (b.likes || 0) + (b.replies?.length || 0) * 2;
                return scoreB - scoreA;
            });
        } else {
            // 最新
            result.sort((a, b) => new Date(b.time) - new Date(a.time));
        }
        
        // 分页支持
        const page = parseInt(urlObj.searchParams.get('page')) || 1;
        const limit = parseInt(urlObj.searchParams.get('limit')) || 20;
        const start = (page - 1) * limit;
        const paginatedResult = result.slice(start, start + limit);
        
        sendJSON(res, 200, {
            posts: paginatedResult,
            total: result.length,
            page,
            totalPages: Math.ceil(result.length / limit)
        });
        return;
    }
    
    // API: 创建帖子
    if (url === '/api/posts' && method === 'POST') {
        try {
            const body = await parseBody(req);
            const { title, content, author, authorId, category } = body;
            
            // Validate content
            const validation = validateContent(title, content);
            if (!validation.valid) {
                sendJSON(res, 400, { error: validation.error });
                return;
            }
            
            const userId = authorId || 'guest';
            if (!users[userId]) {
                users[userId] = {
                    name: author || '游客',
                    avatar: '👤',
                    role: 'guest'
                };
            }
            
            // 验证分类 - 只允许有效分类
            const validCategories = ['公告', '技术', '学习', '工作', '生活', '娱乐', '其他'];
            const postCategory = validCategories.includes(category) ? category : '其他';
            
            const newPost = {
                id: Date.now(),
                title: title.trim(),
                content: content.trim(),
                author: users[userId].name,
                authorId: userId,
                category: postCategory,
                likes: 0,
                views: 0,
                time: new Date().toISOString(),
                replies: []
            };
            
            posts.push(newPost);
            saveData();
            
            console.log(`新帖子创建: ${newPost.title} by ${users[userId].name}`);
            
            // AI 自动回复
            setTimeout(() => {
                const aiReply = {
                    id: Date.now(),
                    ...generateAIResponse(newPost.title, newPost.content, newPost.category)
                };
                aiReply.time = new Date().toISOString();
                
                const post = posts.find(p => p.id === newPost.id);
                if (post) {
                    post.replies.push(aiReply);
                    saveData();
                    console.log(`AI 回复了帖子: ${newPost.title}`);
                }
            }, 2000 + Math.random() * 3000);
            
            sendJSON(res, 201, newPost);
        } catch (e) {
            console.error('Create post error:', e.message);
            sendJSON(res, 400, { error: '请求格式错误' });
        }
        return;
    }
    
    // API: 点赞帖子
    const likePostMatch = url.match(/^\/api\/posts\/(\d+)\/like$/);
    if (likePostMatch && method === 'POST') {
        const postId = parseInt(likePostMatch[1]);
        const post = posts.find(p => p.id === postId);
        
        if (!post) {
            sendJSON(res, 404, { error: '帖子不存在' });
            return;
        }
        
        post.likes = (post.likes || 0) + 1;
        saveData();
        sendJSON(res, 200, { likes: post.likes });
        return;
    }
    
    // API: 点赞回复
    const likeReplyMatch = url.match(/^\/api\/posts\/(\d+)\/replies\/(\d+)\/like$/);
    if (likeReplyMatch && method === 'POST') {
        const postId = parseInt(likeReplyMatch[1]);
        const replyId = parseInt(likeReplyMatch[2]);
        const post = posts.find(p => p.id === postId);
        
        if (!post) {
            sendJSON(res, 404, { error: '帖子不存在' });
            return;
        }
        
        const reply = post.replies.find(r => r.id === replyId);
        if (!reply) {
            sendJSON(res, 404, { error: '回复不存在' });
            return;
        }
        
        reply.likes = (reply.likes || 0) + 1;
        saveData();
        sendJSON(res, 200, { likes: reply.likes });
        return;
    }
    
    // API: 回复帖子
    const replyMatch = url.match(/^\/api\/posts\/(\d+)\/replies$/);
    if (replyMatch && method === 'POST') {
        try {
            const postId = parseInt(replyMatch[1]);
            const body = await parseBody(req);
            const { content, author, authorId } = body;
            
            // Validate reply content
            const validation = validateReply(content);
            if (!validation.valid) {
                sendJSON(res, 400, { error: validation.error });
                return;
            }
            
            const post = posts.find(p => p.id === postId);
            if (!post) {
                sendJSON(res, 404, { error: '帖子不存在' });
                return;
            }
            
            const userId = authorId || 'guest';
            if (!users[userId]) {
                users[userId] = {
                    name: author || '游客',
                    avatar: '👤',
                    role: 'guest'
                };
            }
            
            const reply = {
                id: Date.now(),
                author: users[userId].name,
                authorId: userId,
                content: content.trim(),
                likes: 0,
                time: new Date().toISOString(),
                isUser: true
            };
            
            post.replies.push(reply);
            saveData();
            
            console.log(`用户回复帖子 ${postId}`);
            
            // AI 自动回复
            setTimeout(() => {
                const aiReply = {
                    id: Date.now(),
                    ...generateAIResponse(post.title, content, post.category)
                };
                aiReply.time = new Date().toISOString();
                
                const updatedPost = posts.find(p => p.id === postId);
                if (updatedPost) {
                    updatedPost.replies.push(aiReply);
                    saveData();
                    console.log(`AI 回复用户回复 in post ${postId}`);
                }
            }, 2000 + Math.random() * 3000);
            
            sendJSON(res, 201, reply);
        } catch (e) {
            console.error('Reply error:', e.message);
            sendJSON(res, 400, { error: '请求格式错误' });
        }
        return;
    }
    
    // API: 删除帖子
    const deleteMatch = url.match(/^\/api\/posts\/(\d+)$/);
    if (deleteMatch && method === 'DELETE') {
        const postId = parseInt(deleteMatch[1]);
        const index = posts.findIndex(p => p.id === postId);
        
        if (index === -1) {
            sendJSON(res, 404, { error: '帖子不存在' });
            return;
        }
        
        posts.splice(index, 1);
        saveData();
        sendJSON(res, 200, { success: true });
        return;
    }
    
    // API: 获取热门帖子
    if (url === '/api/posts/hot' && method === 'GET') {
        let result = [...posts];
        result.sort((a, b) => {
            const scoreA = (a.likes || 0) + (a.replies?.length || 0) * 2;
            const scoreB = (b.likes || 0) + (b.replies?.length || 0) * 2;
            return scoreB - scoreA;
        });
        sendJSON(res, 200, result.slice(0, 10));
        return;
    }
    
    // API: 统计信息
    if (url === '/api/stats' && method === 'GET') {
        const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
        const totalReplies = posts.reduce((sum, p) => sum + (p.replies?.length || 0), 0);
        const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
        const categoryStats = {};
        posts.forEach(p => {
            const cat = p.category || '其他';
            categoryStats[cat] = (categoryStats[cat] || 0) + 1;
        });
        
        sendJSON(res, 200, {
            totalPosts: posts.length,
            totalUsers: Object.keys(users).length,
            totalLikes,
            totalReplies,
            totalViews,
            categoryStats
        });
        return;
    }
    
    // API: 热门话题标签
    if (url === '/api/trending' && method === 'GET') {
        // 统计热门关键词
        const wordCount = {};
        const skipWords = ['测试', 'test', '帖子', 'testing', '自动化', '一个', '这个', '什么', '如何', '怎么', '可以', 'api', 'direct', 'post', 'cron'];
        
        posts.forEach(p => {
            // 跳过AI帖子和测试帖子
            if (p.author.startsWith('AI')) {
                return;
            }
            
            // 跳过包含测试相关关键词的帖子
            const titleLower = p.title.toLowerCase();
            if (titleLower.includes('test') || titleLower.includes('测试') || titleLower.includes('cron')) {
                return;
            }
            
            // 从标题提取关键词，过滤空字符串
            const words = p.title.split(/[,，、\s]/).filter(w => w && w.length > 1 && !skipWords.some(sw => w.toLowerCase().includes(sw.toLowerCase())));
            
            // 只有当帖子有实际互动时才统计
            const score = (p.likes || 0) + (p.replies?.length || 0) * 2;
            if (score > 0) {
                words.forEach(w => {
                    const key = w.toLowerCase();
                    wordCount[key] = (wordCount[key] || 0) + score;
                });
            }
        });
        
        // 排序取前10
        const trending = Object.entries(wordCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, score]) => ({ word, score }));
        
        sendJSON(res, 200, trending);
        return;
    }
    
    // API: 上传图片 (Base64)
    if (url === '/api/upload' && method === 'POST') {
        try {
            const body = await parseBody(req);
            const { image, filename } = body;
            
            if (!image) {
                sendJSON(res, 400, { error: '没有图片数据' });
                return;
            }
            
            // 检查是否为图片格式
            if (!image.startsWith('data:image/')) {
                sendJSON(res, 400, { error: '无效的图片格式' });
                return;
            }
            
            // 保存到 uploads 目录
            const uploadsDir = path.join(__dirname, 'public', 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            
            const ext = image.match(/data:image\/(\w+);/)[1] || 'png';
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
            const filePath = path.join(uploadsDir, fileName);
            
            // 提取 Base64 数据
            const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
            
            sendJSON(res, 200, { 
                url: `/uploads/${fileName}`,
                filename: fileName
            });
        } catch (e) {
            console.error('Upload error:', e);
            sendJSON(res, 400, { error: '上传失败' });
        }
        return;
    }
    
    // API: 获取用户信息及帖子
    const userMatch = url.match(/^\/api\/users\/(.+)$/);
    if (userMatch && method === 'GET') {
        const userId = userMatch[1];
        const user = users[userId];
        
        if (!user) {
            sendJSON(res, 404, { error: '用户不存在' });
            return;
        }
        
        // 获取该用户的所有帖子
        const userPosts = posts.filter(p => p.authorId === userId);
        const userReplies = [];
        posts.forEach(p => {
            p.replies?.forEach(r => {
                if (r.authorId === userId) {
                    userReplies.push({ postId: p.id, postTitle: p.title, ...r });
                }
            });
        });
        
        sendJSON(res, 200, {
            user,
            posts: userPosts,
            replies: userReplies,
            stats: {
                postCount: userPosts.length,
                replyCount: userReplies.length,
                totalLikes: userPosts.reduce((sum, p) => sum + (p.likes || 0), 0)
            }
        });
        return;
    }
    
    // Health check
    if (url === '/api/health' && method === 'GET') {
        sendJSON(res, 200, { 
            status: 'ok', 
            posts: posts.length,
            users: Object.keys(users).length,
            version: '2.4',
            uptime: process.uptime ? Math.floor(process.uptime()) : 0
        });
        return;
    }
    
    // Serve static files
    if (method === 'GET') {
        let filePath;
        if (url === '/' || url === '/index.html') {
            filePath = path.join(__dirname, 'public', 'index.html');
        } else {
            filePath = path.join(__dirname, 'public', url);
        }
        serveStatic(req, res, filePath);
        return;
    }
    
    res.writeHead(404);
    res.end('Not Found');
}

function getRandomAvatar() {
    const avatars = ['😊', '😎', '🤓', '😄', '🙂', '😉', '🤗', '😺', '🐱', '🦊', '🐼', '🐨'];
    return avatars[Math.floor(Math.random() * avatars.length)];
}

// Start server
loadData();
const server = http.createServer(handleRequest);
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🤖 AI Forum v2.0 服务器已启动！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log(`📁 数据库文件: ${DB_FILE}`);
    console.log(`📝 帖子数量: ${posts.length}`);
    console.log(`👥 用户数量: ${Object.keys(users).length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ 新功能: 用户登录 | 帖子分类 | 搜索 | 点赞 | 图片上传 | 热门话题');
    console.log('');
});
