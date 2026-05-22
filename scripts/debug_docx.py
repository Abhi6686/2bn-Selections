import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

p = Path(r"c:\Users\StepronTech138\Videos\2BN\Selections\Level 1 Selections .docx")
with zipfile.ZipFile(p) as z:
    rels = ET.fromstring(z.read("word/_rels/document.xml.rels"))
    for rel in rels:
        print(rel.attrib)
    xml = z.read("word/document.xml").decode()
    ids = re.findall(r'r:embed="([^"]+)"', xml)
    print("ids", ids)
