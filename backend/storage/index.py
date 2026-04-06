"""
Облачное хранилище: multipart загрузка по чанкам, список и удаление файлов.
Каждый чанк — отдельный запрос, обходит лимит тела функции.
"""

import json
import os
import base64
import boto3
import urllib.parse


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

BUCKET = 'files'
PREFIX = 'informatika-cloud/'


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        region_name='us-east-1',
    )


def handler(event: dict, context) -> dict:
    """Обработчик запросов облачного хранилища"""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    s3 = get_s3()
    access_key = os.environ['AWS_ACCESS_KEY_ID']

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    # GET — список файлов
    if method == 'GET' and not action:
        response = s3.list_objects_v2(Bucket=BUCKET, Prefix=PREFIX)
        files = []
        for obj in response.get('Contents', []):
            key = obj['Key']
            if key == PREFIX:
                continue
            filename = key[len(PREFIX):]
            filename_decoded = urllib.parse.unquote(filename)
            cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"
            files.append({
                'key': key,
                'name': filename_decoded,
                'size': obj['Size'],
                'last_modified': obj['LastModified'].isoformat(),
                'url': cdn_url,
            })
        files.sort(key=lambda x: x['last_modified'], reverse=True)
        return {
            'statusCode': 200,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'files': files}),
        }

    # POST?action=start — начать multipart upload
    if method == 'POST' and action == 'start':
        body = json.loads(event.get('body', '{}'))
        file_name = body.get('file_name', 'file')
        file_type = body.get('file_type', 'application/octet-stream')
        safe_name = urllib.parse.quote(file_name, safe='.-_()')
        key = f"{PREFIX}{safe_name}"

        resp = s3.create_multipart_upload(
            Bucket=BUCKET,
            Key=key,
            ContentType=file_type,
        )
        upload_id = resp['UploadId']
        cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"
        return {
            'statusCode': 200,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'upload_id': upload_id, 'key': key, 'cdn_url': cdn_url}),
        }

    # POST?action=chunk — загрузить часть
    if method == 'POST' and action == 'chunk':
        body = json.loads(event.get('body', '{}'))
        key = body.get('key')
        upload_id = body.get('upload_id')
        part_number = int(body.get('part_number', 1))
        chunk_b64 = body.get('chunk_data', '')

        chunk_bytes = base64.b64decode(chunk_b64)
        resp = s3.upload_part(
            Bucket=BUCKET,
            Key=key,
            UploadId=upload_id,
            PartNumber=part_number,
            Body=chunk_bytes,
        )
        etag = resp['ETag']
        return {
            'statusCode': 200,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'etag': etag, 'part_number': part_number}),
        }

    # POST?action=finish — завершить multipart upload
    if method == 'POST' and action == 'finish':
        body = json.loads(event.get('body', '{}'))
        key = body.get('key')
        upload_id = body.get('upload_id')
        parts = body.get('parts', [])  # [{'part_number': 1, 'etag': '...'}, ...]

        s3.complete_multipart_upload(
            Bucket=BUCKET,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={
                'Parts': [{'PartNumber': p['part_number'], 'ETag': p['etag']} for p in parts]
            },
        )
        cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"
        return {
            'statusCode': 200,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'success': True, 'url': cdn_url}),
        }

    # POST?action=abort — отменить загрузку при ошибке
    if method == 'POST' and action == 'abort':
        body = json.loads(event.get('body', '{}'))
        key = body.get('key')
        upload_id = body.get('upload_id')
        s3.abort_multipart_upload(Bucket=BUCKET, Key=key, UploadId=upload_id)
        return {
            'statusCode': 200,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'success': True}),
        }

    # DELETE — удаление файла
    if method == 'DELETE':
        body = json.loads(event.get('body', '{}'))
        key = body.get('key')
        if not key or not key.startswith(PREFIX):
            return {
                'statusCode': 400,
                'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Некорректный ключ файла'}),
            }
        s3.delete_object(Bucket=BUCKET, Key=key)
        return {
            'statusCode': 200,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'success': True}),
        }

    return {
        'statusCode': 405,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps({'error': 'Метод не поддерживается'}),
    }
