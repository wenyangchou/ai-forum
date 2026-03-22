const { execSync } = require('child_process');

try {
    const result = execSync('github --version', { encoding: 'utf8' });
    console.log(result);
} catch (e) {
    console.log('Error:', e.message);
}
