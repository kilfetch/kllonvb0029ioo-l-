"""
Расширенный тестовый сервер для сайта ReFind.
Обрабатывает статические файлы, API-запросы и поддерживает CORS.
Версия: 1.0.0 (Финальная версия)
"""

from flask import Flask, request, jsonify, send_from_directory, redirect, abort, session
from flask_cors import CORS
import os
import json
import time
import socket
import datetime
import re
import requests
import uuid
import logging
import hashlib
from logging.handlers import RotatingFileHandler
from werkzeug.exceptions import NotFound
import random
import traceback

import argparse
parser = argparse.ArgumentParser(description='Расширенный сервер ReFind')
parser.add_argument('--port', type=int, default=5000, help='Порт для запуска сервера')
parser.add_argument('--host', type=str, default='127.0.0.1', help='Хост для запуска сервера')
parser.add_argument('--debug', action='store_true', help='Включить режим отладки')
args = parser.parse_args()

if not os.path.exists('logs'):
    os.makedirs('logs')

main_logger = logging.getLogger('refind')
main_logger.setLevel(logging.DEBUG)

file_handler = RotatingFileHandler('logs/server.log', maxBytes=5*1024*1024, backupCount=10, encoding='utf-8')
file_handler.setLevel(logging.INFO)

log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(log_formatter)

main_logger.addHandler(file_handler)

session_loggers = {}

app = Flask(__name__, static_folder='.')
app.secret_key = os.environ.get('SECRET_KEY', 'refind-default-secret-key-8x7n3o')
CORS(app, resources={r"/*": {"origins": "*"}})
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['JSON_AS_ASCII'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Strict'

server_stats = {
    'start_time': datetime.datetime.now(),
    'api_requests': 0,
    'search_requests': 0,
    'errors': 0,
    'last_request_time': None,
    'uptime': 0,
    'total_requests': 0,
}

search_cache = {}

def mask_sensitive_data(text):
    """Маскирует конфиденциальные данные в тексте для логирования"""

    masked_text = re.sub(r'api_key=([^&\s]{4})[^&\s]*', r'api_key=\1****', str(text))
    masked_text = re.sub(r'X-API-Key["\']?\s*[:=]\s*["\']?([^"\'&\s]{4})[^"\'&\s]*', r'X-API-Key: \1****', masked_text)
    
    masked_text = re.sub(r'phone=([0-9]{1,5})[0-9]{5,}', r'phone=\1*****', masked_text)
    masked_text = re.sub(r'phone["\']?\s*[:=]\s*["\']?([0-9]{1,5})[0-9]{5,}', r'phone: \1*****', masked_text)
    
    masked_text = re.sub(r'(\d{1,3}\.\d{1,3}\.)\d{1,3}\.\d{1,3}', r'\1*.*', masked_text)
    
    # Скрываем API URL в сообщениях об ошибках и в логах
    masked_text = re.sub(r'server\.refind\.website', 'api-server.example', masked_text)
    masked_text = re.sub(r'https?://server\.refind\.website/?[^"\'\s]*', 'https://api-server.example/api', masked_text)
    masked_text = re.sub(r'host=\'server\.refind\.website\'', 'host=\'api-server.example\'', masked_text)
    masked_text = re.sub(r'HTTPSConnectionPool\(host=\'[^\']+\'', 'HTTPSConnectionPool(host=\'api-server.example\'', masked_text)
    
    return masked_text

def get_session_logger():
    """Получает или создает логгер для текущей сессии пользователя"""
    try:

        if 'session_id' not in session:
            session['session_id'] = str(uuid.uuid4())
            
        session_id = session['session_id']
        
        if session_id in session_loggers:
            return session_loggers[session_id]
        
        session_logger = logging.getLogger(f'refind.session.{session_id[:8]}')
        session_logger.setLevel(logging.DEBUG)
        
        session_log_path = os.path.join('logs', f'session_{session_id[:8]}.log')
        session_handler = logging.FileHandler(session_log_path, encoding='utf-8')
        session_handler.setFormatter(log_formatter)
        session_logger.addHandler(session_handler)
        
        session_loggers[session_id] = session_logger
        
        return session_logger
    except Exception as e:

        main_logger.error(f"Ошибка при получении сессионного логгера: {e}")
        return main_logger

def log_request(message, level=logging.INFO, include_headers=False):
    """Логирует информацию о запросе с маскировкой конфиденциальных данных"""
    try:
        logger = get_session_logger()
        
        masked_message = mask_sensitive_data(message)
        
        logger.log(level, masked_message)
        
        if include_headers and request:
            headers = dict(request.headers)

            for key, value in headers.items():
                headers[key] = mask_sensitive_data(value)
            
            logger.log(level, f"Заголовки запроса: {headers}")
        
        if level >= logging.WARNING:
            main_logger.log(level, masked_message)
    except Exception as e:

        main_logger.error(f"Ошибка при логировании: {e}")

def load_json_data(file_path, default_data=None):
    """Загружает данные из JSON файла или возвращает default_data если файл недоступен."""
    try:
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    log_request(f"Успешно загружен файл: {file_path}", logging.INFO)
                    return data
            except json.JSONDecodeError as e:
                log_request(f"Ошибка при парсинге JSON в {file_path}: {str(e)}", logging.ERROR)
                return default_data
        else:
            log_request(f"Файл не найден: {file_path}", logging.WARNING)
            return default_data
    except Exception as e:
        log_request(f"Ошибка при загрузке {file_path}: {str(e)}", logging.ERROR)
        return default_data

SEARCH_DATA = load_json_data('api/search.json', {'results': []})
FALLBACK_DATA = load_json_data('api/fallback.json', {'status': 'error'})

def load_config():
    try:
        config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'js', 'config.js')
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                content = f.read()

                match = re.search(r'const\s+CONFIG\s*=\s*({[\s\S]*?});', content)
                if match:

                    config_str = match.group(1)

                    config_str = config_str.replace("'", '"')

                    config_str = re.sub(r'//.*?\n', '\n', config_str)

                    try:
                        return json.loads(config_str)
                    except json.JSONDecodeError:
                        log_request("Не удалось разобрать конфигурацию как JSON", logging.ERROR)
        log_request("Файл конфигурации не найден или имеет неверный формат", logging.WARNING)
        return {
            "SERVER": {"port": 5000}
        }
    except Exception as e:
        log_request(f"Ошибка при загрузке конфигурации: {str(e)}", logging.ERROR)
        return {
            "SERVER": {"port": 5000}
        }

CONFIG = load_config()

def jsonp_response(data, callback=None, status=200):
    """Формирует JSONP или JSON ответ с правильными заголовками"""

    if 'results' not in data and not isinstance(data, list):

        if 'data' in data:
            data['results'] = data.pop('data')
        else:

            data['results'] = []
    
    if callback:

        json_str = json.dumps(data, ensure_ascii=False)
        response_data = f"{callback}({json_str});"
        response = app.response_class(
            response=response_data,
            status=status,
            mimetype='application/javascript'
        )

        response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
    else:

        response = app.response_class(
            response=json.dumps(data, ensure_ascii=False),
            status=status,
            mimetype='application/json'
        )

        response.headers['Content-Type'] = 'application/json; charset=utf-8'
    
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key, X-Requested-With'
    
    log_request(f"Отправляем ответ со статусом {status} и заголовками: {dict(response.headers)}", logging.DEBUG)
    return response

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/databases', methods=['GET', 'OPTIONS'])
def databases_handler():
    """Обработка запросов списка доступных баз данных"""

    if request.method == 'OPTIONS':
        response = app.response_class(
            response="",
            status=200
        )
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key, X-Requested-With'
        return response
        
    try:
        log_request(f"=== Получен запрос к /databases с параметрами: {dict(request.args)}", logging.DEBUG)
        log_request(f"=== Заголовки запроса: {dict(request.headers)}", logging.DEBUG)
        
        api_key = request.args.get('api_key', '')
        callback = request.args.get('callback', None)
        
        valid_api_key = '5386c7fd-f568-49f8-a36e-db8d2e705bdc'
        if not api_key or api_key != valid_api_key:
            result = {
                'status': 'error',
                'message': 'Некорректный API ключ',
                'databases': []
            }
            return jsonp_response(result, callback, 401)
        
        cache_key = "databases_list"
        if cache_key in search_cache:
            log_request(f"Найдено в кеше: {cache_key}", logging.DEBUG)
            result = search_cache[cache_key]
            return jsonp_response(result, callback)
        
        server_stats['total_requests'] += 1
        server_stats['last_request_time'] = datetime.datetime.now()
        
        try:
            log_request(f"Запрос к внешнему API для получения списка баз данных", logging.DEBUG)
            external_api_url = "https://server.refind.website/databases"
            
            headers = {
                'User-Agent': 'ReFind/1.0',
                'Accept': 'application/json, text/plain, */*',
                'X-API-Key': api_key,
                'Origin': request.host_url.rstrip('/'),
                'Referer': request.host_url
            }
            
            params = {
                "api_key": api_key,
                "format": "json"
            }
            
            response = requests.get(
                external_api_url,
                params=params,
                headers=headers,
                timeout=15,
                allow_redirects=False
            )
            
            log_request(f"Внешний API вернул статус: {response.status_code}", logging.DEBUG)
            log_request(f"Заголовки ответа: {dict(response.headers)}", logging.DEBUG)
            
            if response.status_code == 200:
                try:

                    content_type = response.headers.get('Content-Type', '')
                    log_request(f"Content-Type ответа: {content_type}", logging.DEBUG)
                    
                    if 'application/json' in content_type or content_type == '':

                        result = response.json()
                        log_request(f"Успешный ответ от внешнего API: {result}", logging.DEBUG)
        
                        search_cache[cache_key] = result
        
                        return jsonp_response(result, callback)
                    else:

                        error_content = response.text[:100] + "..." if len(response.text) > 100 else response.text
                        log_request(f"Неверный формат ответа (не JSON): {error_content}", logging.WARNING)
                        
                        try:
                            json_result = json.loads(response.text)
                            log_request("Успешно распарсили ответ как JSON, несмотря на некорректный Content-Type", logging.DEBUG)

                            search_cache[cache_key] = json_result
                            return jsonp_response(json_result, callback)
                        except json.JSONDecodeError:

                            log_request("Не удалось распарсить ответ как JSON", logging.ERROR)
                        
                        error_result = {
                            'status': 'error',
                            'message': 'Внешний API вернул ответ в неправильном формате',
                            'error_type': 'INVALID_RESPONSE_FORMAT',
                            'databases': []
                        }
                        return jsonp_response(error_result, callback, 500)
                except json.JSONDecodeError as e:
                    error_message = f"Некорректный JSON в ответе внешнего API: {str(e)}"
                    log_request(error_message, logging.ERROR)
                    
                    error_content = response.text[:100] + "..." if len(response.text) > 100 else response.text
                    log_request(f"Содержимое ответа: {error_content}", logging.DEBUG)
                    
                    log_request("Возвращаем локальные данные из databases.json", logging.INFO)
                    fallback_data = load_json_data('api/databases.json', {'databases': []})
                    return jsonp_response(fallback_data, callback)
            else:
                error_message = f"Внешний API вернул ошибку: {response.status_code}"
                log_request(error_message, logging.ERROR)
                
                log_request("Возвращаем локальные данные из databases.json", logging.INFO)
                fallback_data = load_json_data('api/databases.json', {'databases': []})
                return jsonp_response(fallback_data, callback)
        except requests.RequestException as e:

            error_message = f"Ошибка при запросе к внешнему API: {str(e)}"
            log_request(error_message, logging.ERROR)
            
            log_request("Возвращаем локальные данные из databases.json", logging.INFO)
            fallback_data = load_json_data('api/databases.json', {'databases': []})
            return jsonp_response(fallback_data, callback)
            
    except Exception as e:

        error_message = f"Неожиданная ошибка при обработке запроса /databases: {str(e)}"
        log_request(error_message, logging.ERROR)
        traceback_info = traceback.format_exc()
        log_request(f"Traceback: {traceback_info}", logging.ERROR)
        
        result = {
            'status': 'error',
            'message': 'Внутренняя ошибка сервера при обработке запроса',
            'error_type': 'SERVER_ERROR',
            'databases': []
        }
        return jsonp_response(result, callback, 500)

@app.route('/search.html')
def search_html_page():
    response = send_from_directory('.', 'search.html')
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    return response

@app.route('/search')
def search_page():

    if 'phone' in request.args or 'api_key' in request.args or 'format' in request.args:
        return search_handler()
    response = send_from_directory('.', 'search.html')
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    return response

@app.route('/api')
@app.route('/api.html')
def api_page():
    response = send_from_directory('.', 'api.html')
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    return response

@app.route('/databases')
@app.route('/databases.html')
def databases_page():
    response = send_from_directory('.', 'databases.html')
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    return response

@app.route('/news')
@app.route('/news.html')
def news_page():
    response = send_from_directory('.', 'news.html')
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    return response

@app.route('/mobile-blocked')
@app.route('/mobile-blocked.html')
def mobile_blocked_page():
    response = send_from_directory('.', 'mobile-blocked.html')
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    return response

@app.route('/mobile-detect')
def mobile_detect():
    """Проверка мобильного устройства без редиректа"""
    user_agent = request.headers.get('User-Agent', '')
    is_mobile = any(pattern in user_agent.lower() for pattern in ['android', 'iphone', 'ipad', 'mobile'])
    
    return jsonify({
        'mobile': is_mobile,
        'redirect': False,
        'api_request': True
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    start_time = app.config.get('start_time', time.time())
    uptime_seconds = int(time.time() - start_time)
    
    callback = request.args.get('callback', None)
    result = {
        "status": "up",
        "uptime_seconds": uptime_seconds,
        "version": "1.0.0",
        "timestamp": datetime.datetime.now().isoformat()
    }

    return jsonp_response(result, callback)

@app.route('/search', methods=['GET', 'OPTIONS'])
def search_handler():
    """Обработка поиска через URL параметры"""

    if request.method == 'OPTIONS':
        response = app.response_class(
            response="",
            status=200
        )
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key, X-Requested-With'
        return response
        
    if not ('phone' in request.args or 'api_key' in request.args or 'format' in request.args):
        response = send_from_directory('.', 'search.html')
        response.headers['Content-Type'] = 'text/html; charset=utf-8'
        return response
        
    try:
        log_request(f"=== Получен запрос к /search с параметрами: {dict(request.args)}", logging.DEBUG)
        log_request(f"=== Заголовки запроса: {dict(request.headers)}", logging.DEBUG)
        
        phone = request.args.get('phone', '')
        api_key = request.args.get('api_key', '')
        callback = request.args.get('callback', None)
        
        valid_api_key = '5386c7fd-f568-49f8-a36e-db8d2e705bdc'
        if not api_key or api_key != valid_api_key:
            result = {
                'status': 'error',
                'message': 'Некорректный API ключ',
                'results': []
            }
            return jsonp_response(result, callback, 401)
        
        phone = clean_phone_number(phone)
        if not phone or len(phone) != 11 or not (phone.startswith('7') or phone.startswith('8')):
            result = {
                'status': 'error',
                'message': 'Некорректный номер телефона. Формат: 7XXXXXXXXXX или 8XXXXXXXXXX',
                'results': []
            }
            return jsonp_response(result, callback, 400)
            
        cache_key = f"phone:{phone}"
        if cache_key in search_cache:
            log_request(f"Найдено в кеше: {cache_key}", logging.DEBUG)
            result = search_cache[cache_key]
            return jsonp_response(result, callback)
        
        server_stats['search_requests'] += 1
        server_stats['total_requests'] += 1
        server_stats['last_request_time'] = datetime.datetime.now()
        
        try:
            log_request(f"Запрос к внешнему API для номера: {phone}", logging.DEBUG)
            external_api_url = "https://server.refind.website/search"
            
            headers = {
                'User-Agent': 'ReFind/1.0',
                'Accept': 'application/json, text/plain, */*',
                'X-API-Key': api_key,
                'Origin': request.host_url.rstrip('/'),
                'Referer': request.host_url
            }
            
            params = {
                "phone": phone, 
                "api_key": api_key,
                "format": "json"
            }
            
            response = requests.get(
                external_api_url,
                params=params,
                headers=headers,
                timeout=15,
                allow_redirects=False
            )
            
            log_request(f"Внешний API вернул статус: {response.status_code}", logging.DEBUG)
            log_request(f"Заголовки ответа: {dict(response.headers)}", logging.DEBUG)
            
            if response.status_code == 200:
                try:

                    content_type = response.headers.get('Content-Type', '')
                    log_request(f"Content-Type ответа: {content_type}", logging.DEBUG)
                    
                    if 'application/json' in content_type or content_type == '':

                        result = response.json()
                        log_request(f"Успешный ответ от внешнего API: {result}", logging.DEBUG)
        
                        search_cache[cache_key] = result
        
                        if 'results' in result and isinstance(result['results'], list) and len(result['results']) > 10:

                            total_found = len(result['results'])

                            result['results'] = result['results'][:10]

                            result['limited'] = True
                            result['total_found'] = total_found
                            result['visible'] = len(result['results'])
                        
                        return jsonp_response(result, callback)
                    else:

                        error_content = response.text[:100] + "..." if len(response.text) > 100 else response.text
                        log_request(f"Неверный формат ответа (не JSON): {error_content}", logging.WARNING)
                        
                        try:
                            json_result = json.loads(response.text)
                            log_request("Успешно распарсили ответ как JSON, несмотря на некорректный Content-Type", logging.DEBUG)

                            search_cache[cache_key] = json_result
                            return jsonp_response(json_result, callback)
                        except json.JSONDecodeError:

                            log_request("Не удалось распарсить ответ как JSON", logging.ERROR)
                        
                        error_result = {
                            'status': 'error',
                            'message': 'Внешний API вернул ответ в неправильном формате',
                            'error_type': 'INVALID_RESPONSE_FORMAT',
                            'results': []
                        }
                        return jsonp_response(error_result, callback, 500)
                except json.JSONDecodeError as e:
                    error_message = f"Некорректный JSON в ответе внешнего API: {str(e)}"
                    log_request(error_message, logging.ERROR)
                    
                    error_content = response.text[:100] + "..." if len(response.text) > 100 else response.text
                    log_request(f"Содержимое ответа: {error_content}", logging.DEBUG)
                    
                    error_result = {
                        'status': 'error',
                        'message': 'Внешний API вернул некорректный JSON',
                        'error_type': 'INVALID_JSON',
                        'details': str(e),
                        'results': []
                    }
                    return jsonp_response(error_result, callback, 500)
            else:
                error_message = f"Внешний API вернул ошибку: {response.status_code}"
                log_request(error_message, logging.ERROR)
                
                error_content = None
                try:
                    error_content = response.json()
                except:
                    try:
                        error_content = response.text[:200] if response.text else None
                    except:
                        pass
                
                error_result = {
                    'status': 'error',
                    'message': f'Внешний API вернул ошибку {response.status_code}',
                    'error_type': 'API_ERROR',
                    'http_status': response.status_code,
                    'details': error_content,
                    'results': []
                }
                return jsonp_response(error_result, callback, 500)
                
        except requests.RequestException as e:
            error_message = f"Ошибка при запросе к внешнему API: {str(e)}"
            log_request(error_message, logging.ERROR)
            
            # Записываем полные данные об ошибке в лог, но не отправляем клиенту
            log_request(f"Полная информация об ошибке: {str(e)}", logging.ERROR)

            # Создаем обобщенное сообщение об ошибке для клиента
            error_result = {
                'status': 'error',
                'message': 'Не удалось подключиться к внешнему API',
                'error_type': 'CONNECTION_ERROR',
                'results': []
            }
            return jsonp_response(error_result, callback, 503)
    
    except Exception as e:
        log_request(f"Ошибка при поиске: {str(e)}", logging.ERROR)
        server_stats['errors'] += 1
        
        # Записываем полные данные об ошибке в лог, но не отправляем клиенту
        log_request(f"Полная информация об ошибке: {traceback.format_exc()}", logging.ERROR)

        error_result = {
            'status': 'error',
            'message': 'Внутренняя ошибка сервера',
            'error_type': 'SERVER_ERROR',
            'results': []
        }
        return jsonp_response(error_result, callback, 500)

@app.route('/api/search/phone/<phone_number>', methods=['GET'])
def search_by_phone(phone_number):
    """Поиск информации по номеру телефона"""
    try:

        api_key = request.headers.get('X-API-Key', '5386c7fd-f568-49f8-a36e-db8d2e705bdc')
        return search_handler()
    except Exception as e:
        log_request(f"Ошибка при поиске по телефону {phone_number}: {str(e)}", logging.ERROR)
        callback = request.args.get('callback', None)
        result = {
            'status': 'error',
            'message': 'Внутренняя ошибка сервера'
        }
        return jsonp_response(result, callback, 500)

@app.route('/api/search/email/<email>', methods=['GET'])
def search_by_email(email):
    """Поиск по электронной почте"""
    try:

        callback = request.args.get('callback', None)
        
        if not re.match(r'[^@]+@[^@]+\.[^@]+', email):
            result = {
                'status': 'error',
                'message': 'Некорректный email адрес',
                'results': []
            }
            return jsonp_response(result, callback, 400)

        cache_key = f"email:{email}"
        if cache_key in search_cache:
            log_request(f"Найдено в кеше: {cache_key}", logging.DEBUG)
            result = search_cache[cache_key]
            return jsonp_response(result, callback)

        api_key = request.headers.get('X-API-Key', '5386c7fd-f568-49f8-a36e-db8d2e705bdc')
        
        try:
            external_api_url = "https://server.refind.website/api/search/email"
            response = requests.get(
                f"{external_api_url}/{email}",
                headers={"X-API-Key": api_key},
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                search_cache[cache_key] = result
                return jsonp_response(result, callback)
            else:
                result = {
                    'status': 'error',
                    'message': f"Внешний API вернул ошибку: {response.status_code}",
                    'results': []
                }
                return jsonp_response(result, callback, response.status_code)
        except requests.RequestException as e:
            result = {
                'status': 'error',
                'message': f"Ошибка при запросе к внешнему API: {str(e)}",
                'results': []
            }
            return jsonp_response(result, callback, 500)
            
    except Exception as e:
        log_request(f"Ошибка при поиске по email {email}: {str(e)}", logging.ERROR)
        callback = request.args.get('callback', None)
        result = {
            'status': 'error',
            'message': 'Внутренняя ошибка сервера',
            'results': []
        }
        return jsonp_response(result, callback, 500)

@app.route('/api/search/username/<username>', methods=['GET'])
def search_by_username(username):
    """Поиск по имени пользователя"""
    try:
        callback = request.args.get('callback', None)
        
        cache_key = f"username:{username}"
        if cache_key in search_cache:
            log_request(f"Найдено в кеше: {cache_key}", logging.DEBUG)
            result = search_cache[cache_key]
            return jsonp_response(result, callback)

        api_key = request.headers.get('X-API-Key', '5386c7fd-f568-49f8-a36e-db8d2e705bdc')
        
        try:
            external_api_url = "https://server.refind.website/api/search/username"
            response = requests.get(
                f"{external_api_url}/{username}",
                headers={"X-API-Key": api_key},
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                search_cache[cache_key] = result
                return jsonp_response(result, callback)
            else:
                result = {
                    'status': 'error',
                    'message': f"Внешний API вернул ошибку: {response.status_code}",
                    'results': []
                }
                return jsonp_response(result, callback, response.status_code)
        except requests.RequestException as e:
            result = {
                'status': 'error',
                'message': f"Ошибка при запросе к внешнему API: {str(e)}",
                'results': []
            }
            return jsonp_response(result, callback, 500)
            
    except Exception as e:
        log_request(f"Ошибка при поиске по имени пользователя {username}: {str(e)}", logging.ERROR)
        callback = request.args.get('callback', None)
        result = {
            'status': 'error',
            'message': 'Внутренняя ошибка сервера',
            'results': []
        }
        return jsonp_response(result, callback, 500)

@app.route('/api/stats', methods=['POST'])
def collect_stats():
    """Сбор анонимной статистики поисковых запросов"""
    try:

        if not request.is_json:
            log_request("Content-Type не application/json", logging.ERROR)
            return jsonify({
                'status': 'error', 
                'message': 'Content-Type должен быть application/json'
            }), 415
        
        data = request.get_json(silent=True)
        if not data:
            log_request("Отсутствуют JSON данные", logging.ERROR)
            return jsonify({
                'status': 'error', 
                'message': 'Отсутствуют данные'
            }), 400
        
        log_request(f"Получена статистика: {json.dumps(data)}", logging.DEBUG)
        
        return jsonify({'status': 'success'})
    except Exception as e:
        log_request(f"Ошибка при сборе статистики: {str(e)}", logging.ERROR)
        return jsonify({
            'status': 'error', 
            'message': 'Ошибка обработки статистики'
        }), 500

@app.route('/<path:path>')
def send_static(path):
    try:

        blocked_paths = [
            'logs/', 'data/', '.git/', '.env', 'server.py', 
            'status.html', 'tempmail.html', 'databases/', 'db/', 
            'sqlite/', 'mysql/', 'postgresql/', 'config/', 'backup/',
            'admin/', 'secret/', 'keys/', 'credentials/'
        ]
        blocked_extensions = [
            '.log', '.env', '.db', '.sqlite', '.sqlite3', '.sql', '.bak', 
            '.py', '.sh', '.config', '.backup', '.dump', '.csv', '.json', 
            '.yml', '.yaml', '.conf', '.ini', '.key', '.pem', '.cert', '.md'
        ]
        
        if any(path.startswith(blocked) for blocked in blocked_paths):
            return send_from_directory('.', '404.html'), 404
            
        if any(path.endswith(ext) for ext in blocked_extensions):
            return send_from_directory('.', '404.html'), 404
            
        if 'database' in path.lower() or 'db' in path.lower() or 'log' in path.lower() or 'admin' in path.lower():
            return send_from_directory('.', '404.html'), 404
            
        response = send_from_directory('.', path)
        
        if path.endswith('.html'):
            response.headers['Content-Type'] = 'text/html; charset=utf-8'
        
        return response
    except NotFound:

        log_request(f"Файл не найден: {path} запрошен от {request.remote_addr}", logging.WARNING)
        response = send_from_directory('.', '404.html')
        response.headers['Content-Type'] = 'text/html; charset=utf-8'
        return response, 404
    except Exception as e:

        log_request(f"Ошибка при обработке {path}: {str(e)}", logging.ERROR)
        abort(500)

@app.before_request
def before_request():
    """Выполняется перед обработкой каждого запроса"""

    if 'api_key' in request.args or 'format=json' in request.query_string.decode('utf-8') or request.path.startswith('/search'):
        log_request(f"API запрос обнаружен: {request.path}", logging.DEBUG)
        return None
    
    return None

@app.after_request
def after_request(response):
    """Обрабатывает каждый ответ перед отправкой клиенту."""
    try:

        response.headers.add('X-Content-Type-Options', 'nosniff')
        response.headers.add('X-Frame-Options', 'DENY')
        response.headers.add('X-XSS-Protection', '1; mode=block')

        response.headers.add('X-Rate-Limit-Limit', '60')
        response.headers.add('X-Rate-Limit-Remaining', '59')
        response.headers.add('X-Rate-Limit-Reset', str(int(time.time() + 60)))

        response.headers.add('X-RateLimit-Limit', '10')
        response.headers.add('X-RateLimit-Remaining', '9')
        response.headers.add('X-RateLimit-Reset', str(int(time.time() + 600)))

        if request.method == 'OPTIONS':
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
            response.headers.add('Access-Control-Max-Age', '86400')
        elif request.method in ['GET', 'POST']:
            response.headers.add('Access-Control-Allow-Origin', '*')

        if request.method in ['GET', 'POST'] and not is_api_request():
            log_request(f"Завершен запрос: {request.path} ({response.status_code})")
    
        return response
    except Exception as e:
        log_request(f"Ошибка при обработке after_request: {str(e)}", logging.ERROR, True)
        return response

def is_api_request():
    """Проверяет, является ли текущий запрос API-запросом по заголовкам и параметрам"""

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or \
       'application/json' in request.headers.get('Accept', '') or \
       request.headers.get('Content-Type', '').startswith('application/json'):
        return True
    
    if 'api_key' in request.args or \
       request.args.get('format') == 'json' or \
       request.args.get('callback') is not None:
        return True
    
    api_paths = ['/search', '/api/', '/status']
    for path in api_paths:
        if request.path.startswith(path):
            return True
    
    return False

@app.errorhandler(404)
def page_not_found(e):
    server_stats['errors'] += 1
    return send_from_directory('.', '404.html'), 404

@app.errorhandler(500)
def server_error(e):
    server_stats['errors'] += 1
    log_request(f"500 ошибка: {str(e)}", logging.ERROR)
    return jsonify({'status': 'error', 'message': 'Внутренняя ошибка сервера'}), 500

def clean_phone_number(phone):
    """Функция для очистки номера телефона от лишних символов"""
    return re.sub(r'[^0-9]', '', phone)

def get_local_ip():
    """Получение локального IP адреса"""
    try:

        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception as e:
        log_request(f"Не удалось определить локальный IP: {str(e)}", logging.ERROR)
        return "127.0.0.1"

def is_demo_number(phone):
    """Проверяет, является ли номер тестовым демо-номером"""
    return False

def generate_test_results(phone):
    """Заглушка для обратной совместимости"""
    return {
        'status': 'error',
        'message': 'Внешний API недоступен. Пожалуйста, повторите запрос позже.',
        'results': [],
        'count': 0,
        'totalFound': 0,
        'searchTime': 0,
        'execution_time': 0,
        'timestamp': datetime.datetime.now().isoformat()
    }

def get_demo_search_results(phone):
    """Заглушка для обратной совместимости"""
    return {
        'status': 'error',
        'message': 'Внешний API недоступен. Пожалуйста, повторите запрос позже.',
        'results': [],
        'count': 0,
        'totalFound': 0,
        'searchTime': 0,
        'execution_time': 0,
        'timestamp': datetime.datetime.now().isoformat()
    }

def get_random_string(length):
    """Заглушка для обратной совместимости"""
    return 'x' * length

def get_random_name():
    """Заглушка для обратной совместимости"""
    return 'Неизвестно'

def create_mobile_detect_config():
    try:
        if not os.path.exists('mobile-detect.json'):
            log_request("Создаю файл конфигурации mobile-detect.json", logging.INFO)
            config = {
                'enabled': False,
                'redirect': False,
                'whitelist': []
            }
            with open('mobile-detect.json', 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=4, ensure_ascii=False)
            log_request("Файл mobile-detect.json создан успешно", logging.INFO)
    except Exception as e:
        log_request(f"Ошибка при создании файла mobile-detect.json: {str(e)}", logging.ERROR)

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Возвращает логи текущей сессии"""
    try:

        if 'session_id' not in session:
            return jsonify({
                'status': 'error',
                'message': 'Сессия не найдена'
            }), 401
            
        session_id = session['session_id']
        
        session_log_path = os.path.join('logs', f'session_{session_id[:8]}.log')
        
        if not os.path.exists(session_log_path):
            return jsonify({
                'status': 'error',
                'message': 'Логи не найдены для текущей сессии'
            }), 404
        
        max_lines = int(request.args.get('lines', '100'))
        max_lines = min(max_lines, 1000)
        
        with open(session_log_path, 'r', encoding='utf-8') as f:

            lines = list(f)[-max_lines:] if max_lines > 0 else []
            
            level_filter = request.args.get('level', '').upper()
            if level_filter and level_filter in ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']:
                lines = [line for line in lines if f" - {level_filter} - " in line]
            
        return jsonify({
            'status': 'success',
            'logs': lines,
            'count': len(lines),
            'session_id': session_id[:8]
        })
        
    except Exception as e:
        log_request(f"Ошибка при получении логов: {str(e)}", logging.ERROR)
        return jsonify({
            'status': 'error',
            'message': 'Ошибка при получении логов'
        }), 500

@app.route('/api/logs/clear', methods=['POST'])
def clear_logs():
    """Очищает логи текущей сессии"""
    try:

        if 'session_id' not in session:
            return jsonify({
                'status': 'error',
                'message': 'Сессия не найдена'
            }), 401
            
        session_id = session['session_id']
        
        session_log_path = os.path.join('logs', f'session_{session_id[:8]}.log')
        
        if not os.path.exists(session_log_path):
            return jsonify({
                'status': 'success',
                'message': 'Логи не существуют'
            })
        
        with open(session_log_path, 'w', encoding='utf-8') as f:
            f.write('')
        
        log_request("Логи очищены", logging.INFO)
        
        return jsonify({
            'status': 'success',
            'message': 'Логи успешно очищены'
        })
        
    except Exception as e:
        log_request(f"Ошибка при очистке логов: {str(e)}", logging.ERROR)
        return jsonify({
            'status': 'error',
            'message': 'Ошибка при очистке логов'
        }), 500

if __name__ == '__main__':

    create_mobile_detect_config()
    
    local_ip = get_local_ip()
    log_request(f"Запуск сервера на {local_ip}:{args.port} в режиме {'отладки' if args.debug else 'продакшн'}", logging.INFO)
    
    app.run(
        host=args.host,
        port=args.port,
        debug=args.debug,
        threaded=True
    ) 