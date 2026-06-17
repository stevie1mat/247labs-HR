import json
import re

with open('/Users/stevenmathew/.gemini/antigravity-ide/brain/a213ef91-3dce-4d0b-b4ec-a58c44eb70c9/.system_generated/logs/transcript.jsonl', 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'USER_INPUT' and '<!doctype html>' in data.get('content', '').lower():
                content = data['content']
                # Search for 'Requirements' or 'Benefits' near 'name' or 'id'
                # Find all textareas or divs that are rich text and their IDs
                matches = re.findall(r'<textarea[^>]*id="([^"]*)"[^>]*>.*?Requirements.*?</textarea>', content, re.IGNORECASE | re.DOTALL)
                print("Textareas with Requirements:", matches)
                
                # Search for any label containing Requirements and the adjacent input/textarea
                # Let's just print a chunk of HTML around "Requirements"
                idx = content.find("Requirements")
                if idx != -1:
                    print("Found Requirements around index:", idx)
                    print(content[max(0, idx-200):idx+200])
                    
                idx2 = content.find("Benefits")
                if idx2 != -1:
                    print("Found Benefits around index:", idx2)
                    print(content[max(0, idx2-200):idx2+200])
                    
        except Exception as e:
            pass
