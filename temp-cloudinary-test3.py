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

cases = [
    {'resource_type':'raw', 'type':'upload', 'public_id':'temp-test-raw-upload'},
    {'resource_type':'raw', 'type':'authenticated', 'public_id':'temp-test-raw-authenticated'},
    {'resource_type':'raw', 'type':'private', 'public_id':'temp-test-raw-private'},
    {'resource_type':'raw', 'type':'upload', 'public_id':'temp-test-raw-ac', 'access_control':[{'access_type':'anonymous'}]},
    {'resource_type':'raw', 'type':'authenticated', 'public_id':'temp-test-raw-ac-auth', 'access_control':[{'access_type':'anonymous'}]},
]

for case in cases:
    print('CASE', case)
    try:
        res = cloudinary.uploader.upload('temp-test.pdf', **case, folder='test-pdfs', use_filename=False, overwrite=True)
        print(json.dumps(res, indent=2))
        url = res.get('secure_url') or res.get('url')
        print('secure_url', url)
        if url:
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
        print('upload exc', exc)
    print('-----')
