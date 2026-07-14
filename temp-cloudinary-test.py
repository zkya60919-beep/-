import os, json, mimetypes, time, uuid, hashlib
from urllib import request
from pathlib import Path

cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME')
api_key = os.environ.get('CLOUDINARY_API_KEY')
api_secret = os.environ.get('CLOUDINARY_API_SECRET')
if not cloud_name or not api_key or not api_secret:
    raise SystemExit('Missing Cloudinary env vars')

file_path = Path('temp-test.pdf')
with open(file_path, 'rb') as f:
    file_bytes = f.read()

folder = 'test-pdfs'
timestamp = str(int(time.time()))
params = f'folder={folder}&timestamp={timestamp}'
signature = hashlib.sha1((params + api_secret).encode('utf-8')).hexdigest()

boundary = '----WebKitFormBoundary' + uuid.uuid4().hex
body = []

def add_field(name, value):
    body.append(f'--{boundary}'.encode('utf-8'))
    body.append(f'Content-Disposition: form-data; name="{name}"'.encode('utf-8'))
    body.append(b'')
    body.append(value.encode('utf-8'))

add_field('file', '')
add_field('api_key', api_key)
add_field('timestamp', timestamp)
add_field('folder', folder)
add_field('signature', signature)
body.pop(); body.append(f'--{boundary}'.encode('utf-8'))
body.append(f'Content-Disposition: form-data; name="file"; filename="{file_path.name}"'.encode('utf-8'))
ctype = mimetypes.guess_type(str(file_path))[0] or 'application/octet-stream'
body.append(f'Content-Type: {ctype}'.encode('utf-8'))
body.append(b'')
body.append(file_bytes)
body.append(f'--{boundary}--'.encode('utf-8'))
body.append(b'')
request_body = b'\r\n'.join(body)
req = request.Request(f'https://api.cloudinary.com/v1_1/{cloud_name}/raw/upload', data=request_body)
req.add_header('Content-Type', 'multipart/form-data; boundary=' + boundary)
req.add_header('Content-Length', str(len(request_body)))
try:
    with request.urlopen(req) as res:
        data = res.read().decode('utf-8')
        print('status', res.status)
        print(data)
        obj = json.loads(data)
        if 'secure_url' in obj:
            import urllib.request
            try:
                with urllib.request.urlopen(obj['secure_url']) as res2:
                    print('secure_url status', res2.status)
            except Exception as e:
                print('secure_url fetch failed', e)
except Exception as e:
    print('error', e)
    if hasattr(e, 'fp') and e.fp is not None:
        print(e.fp.read().decode('utf-8'))
