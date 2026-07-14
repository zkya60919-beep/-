import os
import urllib.request
import urllib.error
import cloudinary
import cloudinary.utils

cloudinary.config(
    cloud_name=os.environ['CLOUDINARY_CLOUD_NAME'],
    api_key=os.environ['CLOUDINARY_API_KEY'],
    api_secret=os.environ['CLOUDINARY_API_SECRET'])

for t in [None, 'upload', 'authenticated', 'private']:
    opts = {'resource_type': 'raw'}
    if t is not None:
        opts['type'] = t
    try:
        url = cloudinary.utils.private_download_url('test-pdfs/temp-test-raw-upload.pdf', 'pdf', **opts)
        print('type', t, 'url', url)
        req = urllib.request.Request(url, headers={'User-Agent':'python-test'})
        try:
            resp = urllib.request.urlopen(req)
            print('status', resp.status)
            print(resp.getheader('Content-Type'))
            print(resp.read(20))
        except urllib.error.HTTPError as e:
            print('http error', e.code, e.reason)
            print(e.read().decode('utf-8','ignore'))
    except Exception as exc:
        print('generate error', t, exc)
