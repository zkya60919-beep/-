import os
import json
import urllib.request
import urllib.error
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name=os.environ['CLOUDINARY_CLOUD_NAME'],
    api_key=os.environ['CLOUDINARY_API_KEY'],
    api_secret=os.environ['CLOUDINARY_API_SECRET'])

for resource_type in ['raw', 'auto']:
    public_id = f'temp-test-{resource_type}'
    try:
        res = cloudinary.uploader.upload('temp-test.pdf', resource_type=resource_type, folder='test-pdfs', public_id=public_id, use_filename=False, overwrite=True)
        print('resource_type', resource_type)
        print(json.dumps(res, indent=2))
        url = res['secure_url']
        print('url', url)
        req = urllib.request.Request(url, headers={'User-Agent':'python-test'})
        try:
            resp = urllib.request.urlopen(req)
            print('status', resp.status)
            print(resp.getheader('Content-Type'))
            print(resp.read(20))
        except urllib.error.HTTPError as e:
            print('http error', e.code, e.reason)
            print(e.read().decode('utf-8','ignore'))
        except Exception as e:
            print('fetch err', e)
    except Exception as exc:
        print('upload exc', resource_type, exc)
