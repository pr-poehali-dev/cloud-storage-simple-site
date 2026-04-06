"""
Облачное хранилище: загрузка, список и удаление файлов через S3.
Поддерживает русские и латинские названия файлов.
"""

import json
import os
import base64
import boto3
import urllib.parse
from datetime import datetime


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-File-Name, X-File-Type',
}


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def handler(event: dict, context) -> dict:
    """Обработчик запросов облачного хранилища"""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    s3 = get_s3()
    bucket = 'files'
    prefix = 'cloud-storage/'
    access_key = os.environ['AWS_ACCESS_KEY_ID']

    # GET — список файлов
    if method == 'GET':
        response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
        files = []
        for obj in response.get('Contents', []):
            key = obj['Key']
            if key == prefix:
                continue
            filename = key[len(prefix):]
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

    # POST — загрузка файла
    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        file_data_b64 = body.get('file_data')
        file_name = body.get('file_name', 'file')
        file_type = body.get('file_type', 'application/octet-stream')

        file_bytes = base64.b64decode(file_data_b64)
        safe_name = urllib.parse.quote(file_name, safe='.-_()')
        key = f"{prefix}{safe_name}"

        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=file_bytes,
            ContentType=file_type,
            ContentDisposition=f'inline; filename="{file_name}"',
        )

        cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"
        return {
            'statusCode': 200,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'success': True, 'url': cdn_url, 'key': key, 'name': file_name}),
        }

    # DELETE — удаление файла
    if method == 'DELETE':
        body = json.loads(event.get('body', '{}'))
        key = body.get('key')
        if not key or not key.startswith(prefix):
            return {
                'statusCode': 400,
                'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Некорректный ключ файла'}),
            }
        s3.delete_object(Bucket=bucket, Key=key)
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
