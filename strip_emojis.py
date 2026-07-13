import os
import re

def remove_emojis(text):
    # This regex matches most emoji characters
    emoji_pattern = re.compile(
        "["
        u"\U0001f600-\U0001f64f"  # emoticons
        u"\U0001f300-\U0001f5ff"  # symbols & pictographs
        u"\U0001f680-\U0001f6ff"  # transport & map symbols
        u"\U0001f1e0-\U0001f1ff"  # flags (iOS)
        u"\U00002702-\U000027b0"
        u"\U000024C2-\U0001F251"
        u"⚙️"
        u"🧠"
        u"💻"
        u"🎨"
        u"⚙"
        u"🔒"
        u"♿"
        u"🚀"
        u"✨"
        u"📦"
        u"🛠️"
        u"💡"
        "]+", flags=re.UNICODE)
    return emoji_pattern.sub(r'', text)

files = [f for f in os.listdir('.') if f.endswith('.md')]

for filename in files:
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = remove_emojis(content)
    # clean up any empty spaces left after emoji like "##  Title" -> "## Title"
    new_content = new_content.replace('##  ', '## ')
    
    if content != new_content:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Removed emojis from {filename}")
