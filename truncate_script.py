#!/usr/bin/env python3
import os

filePath = r'D:\madkontrol-app\public\modules\egenkontrol\risikoanalyse.html'

# Read the file
with open(filePath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the first occurrence of </html>
htmlCloseIndex = content.find('</html>')

if htmlCloseIndex == -1:
    print('ERROR: </html> tag not found')
    exit(1)

# Include the </html> tag (7 characters)
truncateLength = htmlCloseIndex + 7

# Truncate at that position
truncatedContent = content[:truncateLength]

# Write back
with open(filePath, 'w', encoding='utf-8') as f:
    f.write(truncatedContent)

print(f'File truncated successfully!')
print(f'Removed {len(content) - len(truncatedContent)} characters')
print(f'File now ends at character position {truncateLength}')
