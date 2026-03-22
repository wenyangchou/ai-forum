const { execSync } = require('child_process');

function run(cmd) {
    try {
        console.log('Running:', cmd);
        const result = execSync(cmd, { encoding: 'utf8', shell: true });
        console.log('Result:', result);
        return result;
    } catch (e) {
        console.log('Error:', e.message);
        return null;
    }
}

console.log('=== GitHub CLI Check ===');

// 检查gh状态
run('"C:/Users/Administrator/AppData/Local/GitHubDesktop/bin/github" auth status');
