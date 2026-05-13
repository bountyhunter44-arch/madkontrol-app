with open(r'D:\madkontrol-app\public\modules\egenkontrol\risikoanalyse.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the last occurrence of </html> and truncate there
end_tag = '</html>'
pos = content.rfind(end_tag)
if pos == -1:
    print("ERROR: </html> not found")
else:
    new_content = content[:pos + len(end_tag)] + '\n'
    with open(r'D:\madkontrol-app\public\modules\egenkontrol\risikoanalyse.html', 'w', encoding='utf-8', newline='\n') as f:
        f.write(new_content)
    print(f"SUCCESS: File truncated at position {pos + len(end_tag)}")
    # Count lines
    lines = new_content.split('\n')
    print(f"File now has {len(lines)} lines")
    print(f"Last line: {repr(lines[-2]) if lines[-1] == '' else repr(lines[-1])}")
