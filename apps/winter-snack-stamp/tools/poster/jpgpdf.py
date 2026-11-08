"""JPEG 여러 장을 A4 PDF로 묶어요 (JPEG는 다시 압축하지 않고 그대로 넣어요). jpgpdf.py out.pdf a.jpg b.jpg"""
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
W, H = 595.2, 841.92
objs = []
def add(b): objs.append(b); return len(objs)
pages = []
catalog = add(None); pages_id = add(None)
for f in files:
    data = open(f, 'rb').read()
    w, h = Image.open(f).size
    img = add(b'<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n' % (w, h, len(data)) + data + b'\nendstream')
    content = b'q %.2f 0 0 %.2f 0 0 cm /Im0 Do Q' % (W, H)
    c = add(b'<< /Length %d >>\nstream\n' % len(content) + content + b'\nendstream')
    pages.append(add(b'<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %.2f %.2f] /Resources << /XObject << /Im0 %d 0 R >> >> /Contents %d 0 R >>' % (pages_id, W, H, img, c)))
objs[catalog - 1] = b'<< /Type /Catalog /Pages %d 0 R >>' % pages_id
objs[pages_id - 1] = b'<< /Type /Pages /Kids [%s] /Count %d >>' % (b' '.join(b'%d 0 R' % p for p in pages), len(pages))
buf = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'); offs = []
for i, o in enumerate(objs, 1):
    offs.append(len(buf)); buf += b'%d 0 obj\n' % i + o + b'\nendobj\n'
x = len(buf)
buf += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1) + b''.join(b'%010d 00000 n \n' % o for o in offs)
buf += b'trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, catalog, x)
open(out, 'wb').write(buf)
