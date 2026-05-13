const fs = require('fs');
const path = require('path');

const filePath = path.join('D:', 'madkontrol-app', 'public', 'modules', 'egenkontrol', 'risikoanalyse.html');

// Read the file
const content = fs.readFileSync(filePath, 'utf-8');

// Find the first occurrence of </html>
const htmlCloseIndex = content.indexOf('</html>');

if (htmlCloseIndex === -1) {
    console.log('ERROR: </html> tag not found');
    process.exit(1);
}

// Include the </html> tag (7 characters)
const truncateLength = htmlCloseIndex + 7;

// Truncate at that position
const truncatedContent = content.substring(0, truncateLength);

// Write back
fs.writeFileSync(filePath, truncatedContent, 'utf-8');

console.log('File truncated successfully!');
console.log(`Removed ${content.length - truncatedContent.length} characters`);
console.log(`Original size: ${content.length} characters`);
console.log(`New size: ${truncatedContent.length} characters`);
