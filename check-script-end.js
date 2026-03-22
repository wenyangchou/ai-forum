const fs = require('fs');
const h = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/ai-forum/public/index.html', 'utf8');

const idx = h.indexOf('</script>');
console.log('</script> at position:', idx);

if (idx > 0) {
    console.log('Content after </script>:');
    console.log(h.substring(idx, idx + 100));
}

const scriptStart = h.indexOf('<script>');
const scriptEnd = h.indexOf('</script>');
console.log('\nScript starts at:', scriptStart);
console.log('Script ends at:', scriptEnd);
console.log('Script length:', scriptEnd - scriptStart - 9);

const scriptContent = h.substring(scriptStart + 8, scriptEnd);
console.log('\nFirst 200 chars of script:');
console.log(scriptContent.substring(0, 200));
console.log('\nLast 200 chars of script:');
console.log(scriptContent.substring(scriptContent.length - 200));
