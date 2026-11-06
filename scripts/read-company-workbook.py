"""Read approved catalog columns only; never evaluate formulas or open links."""
import hashlib
from io import BytesIO
import json
from pathlib import Path
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile


def read_workbook(path, all_sheets=False):
    path = Path(path)
    if path.suffix.lower() != '.xlsx' or path.stat().st_size > 20_000_000:
        raise ValueError('Use an .xlsx file smaller than 20 MB.')
    allowed = {
        'Schools Schedule': set('ABCDEF'),
        'Students Data': set('ABCDE'),
        'Jadwal Harian Ekskul 2026': set('ABCDEFGHIJK'),
        'Tanggal Kelas Berjalan': set('ABCDEFGHIJKLMNO'),
    }
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    data = path.read_bytes()
    with zipfile.ZipFile(BytesIO(data)) as archive:
        if sum(item.file_size for item in archive.infolist()) > 50_000_000:
            raise ValueError('Workbook expands beyond the reading limit.')

        def xml(name):
            content = archive.read(name)
            if b'<!DOCTYPE' in content.upper() or b'<!ENTITY' in content.upper():
                raise ValueError('XML declarations are not supported.')
            return ET.fromstring(content)

        shared = [''.join(node.itertext()) for node in xml('xl/sharedStrings.xml').findall('m:si', ns)] if 'xl/sharedStrings.xml' in archive.namelist() else []
        relations = {node.attrib['Id']: node.attrib['Target'] for node in xml('xl/_rels/workbook.xml.rels')}
        sheets = {}
        for sheet in xml('xl/workbook.xml').find('m:sheets', ns):
            name = sheet.attrib['name']
            if not all_sheets and name not in allowed:
                continue
            target = relations[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            member = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
            if not member.startswith('xl/worksheets/'):
                raise ValueError('Unexpected worksheet location.')
            rows = []
            for row in xml(member).findall('m:sheetData/m:row', ns):
                cells = {}
                for cell in row:
                    column = re.sub(r'\d', '', cell.attrib['r'])
                    if not all_sheets and column not in allowed[name]:
                        continue
                    value = cell.find('m:v', ns)
                    value = value.text if value is not None else ''
                    if cell.attrib.get('t') == 's':
                        value = shared[int(value)]
                    elif cell.attrib.get('t') == 'inlineStr':
                        value = ''.join(cell.find('m:is', ns).itertext())
                    if value and value.strip():
                        cells[column] = value.strip()
                if cells:
                    rows.append({'row': int(row.attrib['r']), 'cells': cells})
            sheets[name] = rows
    return {'file': path.name, 'sha256': hashlib.sha256(data).hexdigest(), 'sheets': sheets}


if __name__ == '__main__':
    # Python 3.10 is also supported on the existing Windows setup.
    path = Path(sys.argv[1])
    result = read_workbook(path, '--all-sheets' in sys.argv[2:])
    print(json.dumps(result, ensure_ascii=True))
