// Forum Watchdog - 自动监控并重启论坛服务器
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(__dirname, 'server.js');
const LOG_FILE = path.join(__dirname, 'watchdog.log');

let serverProcess = null;
let restartCount = 0;
const MAX_RESTARTS_PER_HOUR = 10;

function log(msg) {
    const time = new Date().toISOString();
    const logMsg = `[${time}] ${msg}\n`;
    fs.appendFileSync(LOG_FILE, logMsg);
    console.log(msg);
}

function startServer() {
    log('启动论坛服务器...');
    
    serverProcess = spawn('node', [SERVER_PATH], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
    });

    serverProcess.stdout.on('data', (data) => {
        process.stdout.write(data);
    });

    serverProcess.stderr.on('data', (data) => {
        process.stderr.write(data);
    });

    serverProcess.on('exit', (code) => {
        log(`服务器退出，退出码: ${code}`);
        serverProcess = null;
        
        // 检查重启次数
        restartCount++;
        if (restartCount > MAX_RESTARTS_PER_HOUR) {
            log('重启次数过多，暂停1小时');
            setTimeout(() => { restartCount = 0; }, 60 * 60 * 1000);
            setTimeout(tryStartServer, 60 * 60 * 1000);
        } else {
            log(`将在5秒后重启 (今日第${restartCount}次)`);
            setTimeout(tryStartServer, 5000);
        }
    });

    serverProcess.on('error', (err) => {
        log(`服务器启动失败: ${err.message}`);
        serverProcess = null;
        setTimeout(tryStartServer, 5000);
    });
}

function tryStartServer() {
    // 检查端口是否被占用
    const net = require('net');
    const server = net.createServer();
    
    server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            log('端口3000被占用，等待10秒...');
            setTimeout(tryStartServer, 10000);
            return;
        }
    });
    
    server.once('listening', () => {
        server.close();
        startServer();
    });
    
    server.listen(3000, '0.0.0.0');
}

// 定时检查服务器是否存活
function healthCheck() {
    const http = require('http');
    
    const req = http.get('http://localhost:3000/api/health', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.status !== 'ok') {
                    log('健康检查失败，服务器可能异常');
                }
            } catch(e) {}
        });
    });
    
    req.on('error', () => {
        log('健康检查失败，无法连接到服务器');
    });
}

log('=== 看门狗启动 ===');
log('监控目录: ' + __dirname);

// 启动服务器
tryStartServer();

// 每5分钟健康检查
setInterval(healthCheck, 5 * 60 * 1000);

log('监控中... 按 Ctrl+C 停止');
