import os
import time
import urllib.request
import urllib.error
import cloudinary
import cloudinary.utils

cloudinary.config(
    cloud_name=os.environ['CLOUDINARY_CLOUD_NAME'],
    api_key=os.environ['CLOUDINARY_API_KEY'],
    api_secret=os.environ['CLOUDINARY_API_SECRET'])

public_id = 'test-pdfs/temp-test-raw-upload.pdf'
for expires_at in [None, int(time.time()) + 3600, int(time.time()) + 86400*30, int(time.time()) + 86400*365]:
    opts = {'resource_type': 'raw', 'type': 'upload'}
    if expires_at is not None:
        opts['expires_at'] = expires_at
    url = cloudinary.utils.private_download_url(public_id, 'pdf', **opts)
    print('expires_at', expires_at, 'url', url)
    try:
        req = urllib.request.Request(url, headers={'User-Agent':'python-test'})
        resp = urllib.request.urlopen(req)
        print('status', resp.status)
        print(resp.getheader('Content-Type'))
        print(resp.read(20))
    except urllib.error.HTTPError as e:
        print('http error', e.code, e.reason)
        print(e.read().decode('utf-8','ignore'))
    except Exception as e:
        print('fetch err', e)
