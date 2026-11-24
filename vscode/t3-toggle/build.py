#!/usr/bin/env python3
"""Build the local UI extension: python3 build.py /path/to/t3-toggle.vsix."""
import json
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

source = Path(__file__).resolve().parent
package = json.loads((source / 'package.json').read_text())
extension = (source / 'extension.js').read_text()
if any(command in extension for command in ('workbench.action.files.newUntitledFile', 'workbench.action.quickOpen')):
    raise SystemExit('T3 toggle must show an existing tab or an empty editor group, never a placeholder or file picker.')
subprocess.run(['node', '--test', *map(str, sorted(source.glob('*.test.js')))], check=True)
output = Path(sys.argv[1]).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
manifest = f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
<Metadata><Identity Language="en-US" Id="{package['name']}" Version="{package['version']}" Publisher="{package['publisher']}"/><DisplayName>{escape(package['displayName'])}</DisplayName><Description xml:space="preserve">{escape(package['description'])}</Description><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="{package['engines']['vscode']}"/><Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="ui"/></Properties></Metadata>
<Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/>
<Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets>
</PackageManifest>'''
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.writestr('extension.vsixmanifest', manifest)
    archive.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="vsixmanifest" ContentType="text/xml"/></Types>')
    for name in ('package.json', 'extension.js', 'external-links.js', 'external-link-page.js', 'file-links.js', 'codex-terminal-links.js', 'cdp-client.js', 'projects.js', 't3-tab.js'):
        archive.write(source / name, f'extension/{name}')
print(output)
