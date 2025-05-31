#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import time
import logging
import requests
import asyncio
import datetime
import re
from typing import Dict, Any, Optional, List

# Импорт библиотек для работы с Telegram Bot API
from telegram import Update, Bot
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Пути к файлам
CONFIG_FILE = "bot/config.json"
ADMINS_FILE = "bot/admins.txt"

# Токен бота
TOKEN = "7768334034:AAFtzxKZ2pyfL8Z8uXNz9LZtD6mjTh-wYbY"

# Конфигурация по умолчанию
DEFAULT_CONFIG = {
    "api_base_url": "https://server.refind.website/",  # Базовый URL API (будет загружен из config.js)
    "check_interval": 3600,  # Интервал проверки в секундах (по умолчанию 1 час)
    "telegram_topic_id": 475,  # ID темы в супергруппе Telegram
    "telegram_chat_id": None,  # ID супергруппы Telegram (будет установлен при первом добавлении бота в группу)
    "check_endpoints": [""]  # Пустой эндпоинт для проверки корня сервера
}

class APIMonitorBot:
    def __init__(self):
        self.config = self.load_config()
        self.application = None
        self.job = None
        
        # Загрузка базового URL API из config.js
        self.load_api_url_from_config()
        
        # Создаем файл админов, если его нет
        self.create_admins_file()

    async def setup(self):
        """Настройка и запуск бота"""
        # Создаем экземпляр приложения
        self.application = Application.builder().token(TOKEN).build()
        
        # Регистрация обработчиков команд
        self.register_handlers()
        
        # Запуск задачи проверки API
        await self.schedule_api_check()
        
        # Запуск бота
        await self.application.initialize()
        await self.application.start()
        await self.application.updater.start_polling()
        
        logger.info("Бот запущен")

    def load_config(self) -> Dict[str, Any]:
        """Загрузка конфигурации из файла"""
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    # Добавление отсутствующих полей из конфигурации по умолчанию
                    for key, value in DEFAULT_CONFIG.items():
                        if key not in config:
                            config[key] = value
                    return config
            except Exception as e:
                logger.error(f"Ошибка при загрузке конфигурации: {e}")
                
        # Если файл не существует или произошла ошибка, возвращаем конфигурацию по умолчанию
        return DEFAULT_CONFIG.copy()

    def save_config(self) -> None:
        """Сохранение конфигурации в файл"""
        try:
            # Создаем директорию, если она не существует
            os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=4, ensure_ascii=False)
            logger.info("Конфигурация сохранена")
        except Exception as e:
            logger.error(f"Ошибка при сохранении конфигурации: {e}")
            
    def create_admins_file(self) -> None:
        """Создание файла с админами, если его нет"""
        if not os.path.exists(ADMINS_FILE):
            try:
                # Создаем директорию, если она не существует
                os.makedirs(os.path.dirname(ADMINS_FILE), exist_ok=True)
                with open(ADMINS_FILE, 'w', encoding='utf-8') as f:
                    # Добавляем ID админа из запроса
                    f.write("7550171041\n")
                logger.info(f"Создан файл админов: {ADMINS_FILE}")
            except Exception as e:
                logger.error(f"Ошибка при создании файла админов: {e}")
                
    def get_admin_ids(self) -> List[int]:
        """Получение списка ID администраторов из файла"""
        admin_ids = []
        try:
            if os.path.exists(ADMINS_FILE):
                with open(ADMINS_FILE, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and line.isdigit():
                            admin_ids.append(int(line))
        except Exception as e:
            logger.error(f"Ошибка при чтении файла админов: {e}")
        
        # Если список пустой, добавляем ID админа по умолчанию
        if not admin_ids:
            admin_ids.append(7550171041)
            
        return admin_ids
        
    def add_admin_id(self, admin_id: int) -> bool:
        """Добавление нового ID администратора в файл"""
        admin_ids = self.get_admin_ids()
        
        # Проверяем, есть ли уже такой ID
        if admin_id in admin_ids:
            return False
            
        try:
            with open(ADMINS_FILE, 'a', encoding='utf-8') as f:
                f.write(f"{admin_id}\n")
            logger.info(f"Добавлен новый админ с ID: {admin_id}")
            return True
        except Exception as e:
            logger.error(f"Ошибка при добавлении нового админа: {e}")
            return False

    def load_api_url_from_config(self) -> None:
        """Загрузка базового URL API из файла config.js"""
        try:
            config_path = "js/config.js"
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Используем регулярное выражение для извлечения URL
                    api_url_match = re.search(r'api_url\s*:\s*[\'"]([^\'"]+)[\'"]', content)
                    if api_url_match:
                        url = api_url_match.group(1)
                        if url:
                            self.config["api_base_url"] = url
                            logger.info(f"Загружен базовый URL API: {url}")
                            self.save_config()
                            return
        except Exception as e:
            logger.error(f"Ошибка при загрузке базового URL API: {e}")
            
        logger.warning("Не удалось загрузить базовый URL API, используется значение по умолчанию")

    def register_handlers(self) -> None:
        """Регистрация обработчиков команд"""
        self.application.add_handler(CommandHandler("start", self.cmd_start))
        self.application.add_handler(CommandHandler("help", self.cmd_help))
        self.application.add_handler(CommandHandler("status", self.cmd_status))
        self.application.add_handler(CommandHandler("check", self.cmd_check))
        self.application.add_handler(CommandHandler("interval", self.cmd_set_interval))
        self.application.add_handler(CommandHandler("topic", self.cmd_set_topic))
        self.application.add_handler(CommandHandler("settings", self.cmd_settings))
        self.application.add_handler(CommandHandler("addadmin", self.cmd_add_admin))
        self.application.add_handler(CommandHandler("system", self.cmd_system_info))
        self.application.add_handler(CommandHandler("setchat", self.cmd_set_chat))
        self.application.add_handler(CommandHandler("test", self.cmd_test_message))
        
        # Обработчик новых сообщений для автоматического определения ID чата
        self.application.add_handler(MessageHandler(filters.CHAT, self.handle_group_message))
        
        # Обработчик ошибок
        self.application.add_error_handler(self.error_handler)

    async def schedule_api_check(self) -> None:
        """Запуск регулярной проверки API"""
        if self.job:
            self.job.schedule_removal()
            logger.info("Предыдущая задача проверки удалена")
            
        interval = self.config.get("check_interval", 3600)
        minutes = interval // 60
        
        # Запускаем задачу
        self.job = self.application.job_queue.run_repeating(
            self.check_api_job, 
            interval=interval, 
            first=10  # Первая проверка через 10 секунд после запуска
        )
        
        logger.info(f"Запланирована проверка API с интервалом {interval} секунд ({minutes} минут)")

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик команды /start"""
        await update.message.reply_text(
            "👋 Здравствуйте! Я бот для мониторинга API ReFind.\n\n"
            "🔍 Я буду регулярно проверять состояние API и сообщать о его работе.\n\n"
            "🛠️ Используйте /help для получения списка доступных команд."
        )

    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик команды /help"""
        # Показываем ID пользователя для отладки
        user_id = update.effective_user.id
        chat_id = update.effective_chat.id
        
        await update.message.reply_text(
            f"📋 Доступные команды:\n\n"
            f"/start - Начало работы с ботом\n"
            f"/help - Показать это сообщение\n"
            f"/status - Показать текущий статус и настройки\n"
            f"/check - Проверить API прямо сейчас\n"
            f"/interval <минуты> - Установить интервал проверки (в минутах)\n"
            f"/topic <id> - Установить ID темы для отправки сообщений\n"
            f"/settings - Показать текущие настройки\n"
            f"/addadmin <id> - Добавить администратора\n"
            f"/setchat <id> - Установить ID чата для отправки отчетов\n"
            f"/test - Отправить тестовое сообщение\n\n"
            f"🆔 Ваш ID: {user_id}\n"
            f"💬 ID текущего чата: {chat_id}"
        )

    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик команды /status"""
        interval = self.config.get("check_interval", 3600)
        hours, remainder = divmod(interval, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        interval_text = ""
        if hours > 0:
            interval_text += f"{int(hours)} ч "
        if minutes > 0:
            interval_text += f"{int(minutes)} мин "
        if seconds > 0 or (hours == 0 and minutes == 0):
            interval_text += f"{int(seconds)} сек"
            
        status_text = (
            "📊 Текущий статус:\n\n"
            f"🌐 URL сервера: {self.config.get('api_base_url', 'Не установлен')}\n"
            f"⏱️ Интервал проверки: {interval_text}\n"
            f"💬 ID чата: {self.config.get('telegram_chat_id', 'Не установлен')}\n"
            f"📌 ID темы: {self.config.get('telegram_topic_id', 'Не установлен')}\n"
            f"👥 Админы: {', '.join(map(str, self.get_admin_ids()))}"
        )
        
        await update.message.reply_text(status_text)

    async def cmd_check(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик команды /check для немедленной проверки API"""
        # Отправляем сообщение и сохраняем его для последующего редактирования
        message = await update.message.reply_text("🔍 Проверяю состояние API...")
        
        result = await self.check_api()
        
        # Редактируем исходное сообщение вместо отправки нового
        await message.edit_text(
            f"📊 Результаты проверки API:\n\n{result}",
            parse_mode='HTML'
        )

    async def cmd_set_interval(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик команды /interval для установки интервала проверки"""
        # Проверка аргументов
        if not context.args or not context.args[0].isdigit():
            await update.message.reply_text(
                "⚠️ Пожалуйста, укажите интервал в минутах.\n"
                "Пример: /interval 60 (для проверки каждый час)"
            )
            return
            
        # Проверка прав администратора
        user_id = update.effective_user.id
        admin_ids = self.get_admin_ids()
        
        # Исправленная проверка на админа
        if user_id not in admin_ids:
            await update.message.reply_text(
                f"⛔ У вас нет прав для изменения настроек бота\n"
                f"Ваш ID: {user_id}\n"
                f"Список админов: {', '.join(map(str, admin_ids))}"
            )
            return
            
        # Интервал задается в минутах для удобства пользователя
        minutes = int(context.args[0])
        
        # Ограничение минимального интервала в 1 минуту
        if minutes < 1:
            await update.message.reply_text(
                "⚠️ Интервал не может быть меньше 1 минуты. "
                "Установлен минимальный интервал в 1 минуту."
            )
            minutes = 1
            
        # Перевод минут в секунды для хранения в конфигурации
        interval = minutes * 60
            
        # Обновление конфигурации
        self.config["check_interval"] = interval
        self.save_config()
        
        # Перезапуск задачи с новым интервалом
        if self.job:
            self.job.schedule_removal()
            logger.info(f"Предыдущая задача проверки удалена")
        
        # Запускаем задачу заново
        self.job = self.application.job_queue.run_repeating(
            self.check_api_job, 
            interval=interval, 
            first=10  # Первая проверка через 10 секунд после изменения
        )
        
        logger.info(f"Задача проверки перезапущена с интервалом {interval} секунд ({minutes} минут)")
        
        # Отправляем сообщение о настройке интервала и сохраняем его для редактирования
        message = await update.message.reply_text("🔄 Интервал изменен, выполняю немедленную проверку API...")
        
        # Немедленная проверка API для подтверждения работы
        result = await self.check_api()
        
        # Форматирование интервала для сообщения
        interval_text = ""
        if minutes >= 60:
            hours = minutes // 60
            remaining_minutes = minutes % 60
            if hours > 0:
                interval_text += f"{hours} ч "
            if remaining_minutes > 0:
                interval_text += f"{remaining_minutes} мин"
        else:
            interval_text = f"{minutes} мин"
            
        # Редактируем сообщение с результатами проверки
        await message.edit_text(
            f"✅ Интервал проверки API установлен: {interval_text}\n"
            f"Следующая автоматическая проверка через {interval_text}\n\n"
            f"📊 Результаты проверки API:\n\n{result}",
            parse_mode='HTML'
        )

    async def cmd_set_topic(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик команды /topic для установки ID темы"""
        # Проверка аргументов
        if not context.args or not context.args[0].isdigit():
            await update.message.reply_text(
                "⚠️ Пожалуйста, укажите ID темы.\n"
                "Пример: /topic 475"
            )
            return
            
        # Проверка прав администратора
        user_id = update.effective_user.id
        admin_ids = self.get_admin_ids()
        
        # Исправленная проверка на админа
        if user_id not in admin_ids:
            await update.message.reply_text(
                f"⛔ У вас нет прав для изменения настроек бота\n"
                f"Ваш ID: {user_id}\n"
                f"Список админов: {', '.join(map(str, admin_ids))}"
            )
            return
            
        topic_id = int(context.args[0])
        
        # Обновление конфигурации
        self.config["telegram_topic_id"] = topic_id
        self.save_config()
        
        await update.message.reply_text(
            f"✅ ID темы установлен: {topic_id}"
        )

    async def cmd_settings(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик команды /settings для отображения текущих настроек"""
        interval = self.config.get("check_interval", 3600)
        hours, remainder = divmod(interval, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        interval_text = ""
        if hours > 0:
            interval_text += f"{int(hours)} ч "
        if minutes > 0:
            interval_text += f"{int(minutes)} мин "
        if seconds > 0 or (hours == 0 and minutes == 0):
            interval_text += f"{int(seconds)} сек"
            
        settings_text = (
            "⚙️ Текущие настройки:\n\n"
            f"🌐 URL сервера: {self.config.get('api_base_url', 'Не установлен')}\n"
            f"⏱️ Интервал проверки: {interval_text}\n"
            f"💬 ID чата: {self.config.get('telegram_chat_id', 'Не установлен')}\n"
            f"📌 ID темы: {self.config.get('telegram_topic_id', 'Не установлен')}\n"
            f"👥 Админы: {', '.join(map(str, self.get_admin_ids()))}\n\n"
            "📝 Для изменения настроек используйте команды:\n"
            "/interval <минуты> - Изменить интервал проверки\n"
            "/topic <id> - Изменить ID темы\n"
            "/setchat <id> - Установить ID чата\n"
            "/addadmin <id> - Добавить администратора"
        )
        
        await update.message.reply_text(settings_text)

    async def handle_group_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик сообщений в группе для автоматического определения ID чата"""
        chat_id = update.effective_chat.id
        
        # Информируем об ID чата, чтобы пользователь мог его увидеть
        logger.info(f"Получено сообщение из чата с ID: {chat_id}")
        
        # Сохраняем ID чата, если он еще не установлен
        if not self.config.get("telegram_chat_id"):
            self.config["telegram_chat_id"] = chat_id
            self.save_config()
            logger.info(f"Установлен ID чата: {chat_id}")
            
            # Отправляем сообщение о том, что ID чата установлен
            await update.effective_chat.send_message(
                f"✅ ID этого чата ({chat_id}) автоматически установлен для отправки отчетов.\n"
                f"Используйте команду /settings для просмотра настроек."
            )

    async def check_api_job(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Задача для регулярной проверки API"""
        chat_id = self.config.get("telegram_chat_id")
        topic_id = self.config.get("telegram_topic_id")
        
        if not chat_id:
            logger.warning("ID чата не установлен, пропуск проверки API")
            return
            
        result = await self.check_api()
        
        # Отправка результатов в чат
        try:
            await context.bot.send_message(
                chat_id=chat_id,
                text=f"📊 Отчет о состоянии API:\n\n{result}",
                parse_mode='HTML',
                message_thread_id=topic_id
            )
            logger.info(f"Отчет успешно отправлен в чат {chat_id}" + (f" (тема {topic_id})" if topic_id else ""))
        except Exception as e:
            logger.error(f"Ошибка при отправке отчета: {str(e)}")
            logger.error(f"ID чата: {chat_id}, ID темы: {topic_id}")
            # Если произошла ошибка, проверяем настройки и пытаемся сбросить конфигурацию
            if "Chat not found" in str(e):
                logger.error("Бот не добавлен в указанный чат или ID чата неверный")
                # Сбрасываем ID чата, чтобы пользователь мог установить его заново
                self.config["telegram_chat_id"] = None
                self.save_config()
                logger.info("ID чата сброшен из-за ошибки доступа")

    async def check_api(self) -> str:
        """Проверка состояния API"""
        base_url = self.config.get("api_base_url", "https://server.refind.website/")
        # Проверяем только корневой URL
        endpoints = [""]  # Пустой эндпоинт - запрос к корню сервера
        
        results = []
        total_time = 0
        success_count = 0
        error_details = []
        
        current_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M:%S")
        results.append(f"🕒 Время проверки: {current_time}")
        results.append(f"🌐 URL сервера: {base_url}")
        results.append("")
        
        for endpoint in endpoints:
            # Формируем URL с эндпоинтом или без него
            if endpoint:
                if base_url.endswith('/'):
                    url = f"{base_url}{endpoint}"
                else:
                    url = f"{base_url}/{endpoint}"
            else:
                # Если эндпоинт пустой, используем только базовый URL
                url = base_url
                
            try:
                start_time = time.time()
                # Уменьшаем таймаут до 5 секунд
                response = requests.get(url, timeout=5)
                response_time = time.time() - start_time
                total_time += response_time
                
                status_code = response.status_code
                if status_code < 400:
                    success_count += 1
                    status_emoji = "✅"
                else:
                    status_emoji = "❌"
                    error_details.append(f"Ошибка в {url}: код {status_code}")
                    
                results.append(
                    f"{status_emoji} Статус сервера: "
                    f"Код {status_code}, "
                    f"Время {response_time:.2f} сек"
                )
                
                # Добавляем информацию о сервере
                server_info = []
                
                # Получаем информацию о сервере из заголовков
                if 'Server' in response.headers:
                    server_info.append(f"• Сервер: {response.headers['Server']}")
                
                # Получаем информацию о хосте
                try:
                    import socket
                    domain = url.split('/')[2]
                    try:
                        ip = socket.gethostbyname(domain)
                        server_info.append(f"• IP: {ip}")
                        
                        try:
                            hostname = socket.gethostbyaddr(ip)[0]
                            if hostname and hostname != domain:
                                server_info.append(f"• Хост: {hostname}")
                        except:
                            pass
                    except:
                        pass
                except:
                    pass
                
                # Добавляем информацию из важных заголовков
                important_headers = ['Content-Type', 'X-Powered-By', 'X-AspNet-Version', 'X-Runtime', 'Date', 'Last-Modified']
                for header in important_headers:
                    if header in response.headers:
                        server_info.append(f"• {header}: {response.headers[header]}")
                
                # Получаем информацию о SSL сертификате
                try:
                    if url.startswith('https'):
                        import ssl
                        import socket
                        domain = url.split('/')[2].split(':')[0]
                        context = ssl.create_default_context()
                        with socket.create_connection((domain, 443)) as sock:
                            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                                cert = ssock.getpeercert()
                                if cert:
                                    # Извлекаем информацию о сертификате
                                    subject = dict(item[0] for item in cert['subject'])
                                    issuer = dict(item[0] for item in cert['issuer'])
                                    not_after = cert['notAfter']
                                    
                                    server_info.append(f"• SSL сертификат: {subject.get('commonName', 'Неизвестно')}")
                                    server_info.append(f"• Издатель: {issuer.get('commonName', 'Неизвестно')}")
                                    server_info.append(f"• Действителен до: {not_after}")
                except:
                    server_info.append("• SSL: Не удалось получить информацию о сертификате")
                
                # Если есть информация о сервере, добавляем ее в отчет
                if server_info:
                    results.append("🖥️ Информация о сервере:")
                    for info in server_info:
                        results.append(f"  {info}")
                
                # Получаем все заголовки для более подробной информации
                if response.headers:
                    results.append("📋 Заголовки ответа:")
                    for header, value in response.headers.items():
                        results.append(f"  • {header}: {value}")
                
                # Добавляем информацию о содержимом ответа
                content_type = response.headers.get('Content-Type', '')
                
                # Показываем размер ответа
                content_length = int(response.headers.get('Content-Length', '0')) or len(response.content)
                size_kb = content_length / 1024
                results.append(f"📊 Размер ответа: {size_kb:.2f} КБ ({content_length} байт)")
                
                # Если ответ в формате JSON, пытаемся его разобрать
                try:
                    if 'application/json' in content_type:
                        data = response.json()
                        if data:
                            results.append("📄 Данные сервера (JSON):")
                            # Анализируем структуру JSON
                            if isinstance(data, dict):
                                for key, value in data.items():
                                    value_type = type(value).__name__
                                    if isinstance(value, (dict, list)):
                                        value_size = len(value)
                                        results.append(f"  • {key}: {value_type} [{value_size} элементов]")
                                    else:
                                        str_value = str(value)
                                        # Ограничиваем длину значения для отображения
                                        if len(str_value) > 50:
                                            str_value = str_value[:47] + "..."
                                        results.append(f"  • {key}: {str_value}")
                            elif isinstance(data, list):
                                results.append(f"  • Массив данных: {len(data)} элементов")
                                # Показываем первые несколько элементов
                                for i, item in enumerate(data[:3]):
                                    if isinstance(item, dict):
                                        keys = list(item.keys())
                                        results.append(f"  • Элемент {i}: {keys}")
                                    else:
                                        results.append(f"  • Элемент {i}: {str(item)[:50]}")
                                if len(data) > 3:
                                    results.append(f"  • ...и еще {len(data) - 3} элементов")
                    else:
                        # Если не JSON, показываем первые строки текстового ответа
                        text = response.text.strip()
                        if text:
                            results.append("📝 Фрагмент ответа:")
                            # Ограничиваем размер текста
                            if len(text) > 300:
                                text = text[:297] + "..."
                            lines = text.split('\n')
                            for line in lines[:5]:
                                results.append(f"  {line}")
                            if len(lines) > 5:
                                results.append(f"  ...и еще {len(lines) - 5} строк")
                except Exception as e:
                    results.append(f"⚠️ Ошибка парсинга данных: {str(e)}")
                
            except requests.exceptions.Timeout:
                results.append(f"⏱️ Таймаут соединения")
                error_details.append(f"Таймаут при запросе к {url}")
            except requests.exceptions.ConnectionError:
                results.append(f"🔌 Ошибка соединения")
                error_details.append(f"Ошибка соединения при запросе к {url}")
            except Exception as e:
                results.append(f"⚠️ Ошибка: {str(e)}")
                error_details.append(f"Ошибка {str(e)} при запросе к {url}")
                
        # Добавляем общую статистику
        results.append("")
        if endpoints:
            success_rate = (success_count / len(endpoints)) * 100
            avg_response_time = total_time / len(endpoints) if endpoints else 0
            
            if success_rate >= 90:
                health_status = "✅ Отлично"
            elif success_rate >= 70:
                health_status = "⚠️ Есть проблемы"
            else:
                health_status = "❌ Критические ошибки"
                
            results.append(f"🏥 Общее состояние: {health_status}")
            results.append(f"⏱️ Среднее время ответа: {avg_response_time:.2f} сек")
            
            # Добавляем детали ошибок, если они есть
            if error_details:
                results.append("")
                results.append("🔍 Детали ошибок:")
                for i, error in enumerate(error_details, 1):
                    results.append(f"  {i}. {error}")
            
        return "\n".join(results)

    async def cmd_add_admin(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик команды /addadmin для добавления администратора"""
        # Проверка аргументов
        if not context.args or not context.args[0].isdigit():
            await update.message.reply_text(
                "⚠️ Пожалуйста, укажите ID пользователя.\n"
                "Пример: /addadmin 123456789"
            )
            return
            
        # Проверка прав текущего пользователя
        user_id = update.effective_user.id
        admin_ids = self.get_admin_ids()
        
        # Показываем отладочную информацию
        await update.message.reply_text(
            f"🔍 Данные проверки прав:\n"
            f"- Ваш ID: {user_id}\n"
            f"- Список админов: {', '.join(map(str, admin_ids))}\n"
            f"- Результат проверки: {'✅ Вы админ' if user_id in admin_ids else '❌ Вы не админ'}"
        )
        
        # Разрешаем добавлять админов только существующим админам
        if user_id not in admin_ids:
            await update.message.reply_text("⛔ У вас нет прав для добавления администраторов")
            return
            
        admin_id = int(context.args[0])
        
        # Добавляем ID в файл администраторов
        if self.add_admin_id(admin_id):
            await update.message.reply_text(f"✅ Пользователь с ID {admin_id} добавлен в список администраторов")
        else:
            await update.message.reply_text(f"ℹ️ Пользователь с ID {admin_id} уже в списке администраторов")

    async def cmd_system_info(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Получение информации о системе - отключено"""
        await update.message.reply_text(
            "ℹ️ Функция отображения системной информации отключена в текущей версии бота."
        )

    async def cmd_set_chat(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик команды /setchat для установки ID чата"""
        # Отправляем первоначальное сообщение
        message = await update.message.reply_text("🔄 Проверка параметров...")
        
        # Проверка прав администратора
        user_id = update.effective_user.id
        admin_ids = self.get_admin_ids()
        
        # Исправленная проверка на админа
        if user_id not in admin_ids:
            await message.edit_text(
                f"⛔ У вас нет прав для изменения настроек бота\n"
                f"Ваш ID: {user_id}\n"
                f"Список админов: {', '.join(map(str, admin_ids))}"
            )
            return
        
        # Проверка аргументов
        if not context.args:
            # Если аргументов нет, используем текущий чат
            chat_id = update.effective_chat.id
            await message.edit_text(f"🔄 Установка текущего чата (ID: {chat_id}) в качестве чата для отчетов...")
        elif context.args[0].startswith('-') and context.args[0][1:].isdigit():
            # Если указан ID чата
            chat_id = int(context.args[0])
            await message.edit_text(f"🔄 Проверка доступности чата с ID: {chat_id}...")
        else:
            await message.edit_text(
                "⚠️ Некорректный формат ID чата.\n"
                "Пример: /setchat -1002504718480\n"
                "Или используйте команду без аргументов для установки текущего чата"
            )
            return
            
        # Сохраняем старый ID для информирования
        old_chat_id = self.config.get("telegram_chat_id")
        
        # Проверяем доступность чата
        try:
            # Пытаемся отправить тестовое сообщение в чат
            test_message = await context.bot.send_message(
                chat_id=chat_id,
                text=f"🔍 Проверка доступа к чату (ID: {chat_id})",
                disable_notification=True  # Отправляем без уведомления
            )
            
            # Если сообщение отправлено успешно, удаляем его
            await test_message.delete()
            
            # Обновление конфигурации
            self.config["telegram_chat_id"] = chat_id
            self.save_config()
            
            # Редактируем сообщение с результатом
            await message.edit_text(
                f"✅ ID чата установлен: {chat_id}\n"
                f"Предыдущий ID чата: {old_chat_id if old_chat_id else 'Не был установлен'}\n\n"
                f"Используйте /test для отправки тестового сообщения."
            )
            
            logger.info(f"ID чата успешно изменен с {old_chat_id} на {chat_id}")
            
        except Exception as e:
            error_text = str(e)
            await message.edit_text(
                f"❌ Не удалось установить ID чата: {error_text}\n\n"
                f"Вероятные причины:\n"
                f"1. Бот не добавлен в указанный чат\n"
                f"2. ID чата неверный\n"
                f"3. У бота нет прав для отправки сообщений\n\n"
                f"Добавьте бота в нужный чат и повторите попытку."
            )
            logger.error(f"Ошибка при установке ID чата {chat_id}: {error_text}")

    async def cmd_test_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет тестовое сообщение в настроенный чат"""
        # Отправляем первоначальное сообщение и сохраняем его
        message = await update.message.reply_text("🔄 Подготовка тестового сообщения...")
        
        chat_id = self.config.get("telegram_chat_id")
        topic_id = self.config.get("telegram_topic_id")
        
        if not chat_id:
            await message.edit_text(
                "⚠️ ID чата не установлен. Используйте команду /setchat для установки ID чата."
            )
            return
            
        # Проверка прав администратора
        user_id = update.effective_user.id
        admin_ids = self.get_admin_ids()
        
        if user_id not in admin_ids:
            await message.edit_text(
                f"⛔ У вас нет прав для отправки тестовых сообщений\n"
                f"Ваш ID: {user_id}\n"
                f"Список админов: {', '.join(map(str, admin_ids))}"
            )
            return
            
        # Отправляем тестовое сообщение
        try:
            current_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M:%S")
            test_message = (
                f"🧪 <b>Тестовое сообщение</b>\n\n"
                f"🕒 Время отправки: {current_time}\n"
                f"👤 Отправитель: {update.effective_user.first_name} (ID: {user_id})\n"
                f"📋 Настройки бота:\n"
                f"- ID чата: {chat_id}\n"
                f"- ID темы: {topic_id}\n"
                f"- URL API: {self.config.get('api_base_url')}\n"
                f"- Интервал: {self.config.get('check_interval') // 60} мин"
            )
            
            try:
                sent_message = await context.bot.send_message(
                    chat_id=chat_id,
                    text=test_message,
                    parse_mode='HTML',
                    message_thread_id=topic_id
                )
                
                # Редактируем исходное сообщение с результатом
                await message.edit_text(
                    f"✅ Тестовое сообщение отправлено в чат {chat_id}"
                    + (f" (тема {topic_id})" if topic_id else "")
                )
                logger.info(f"Тестовое сообщение успешно отправлено в чат {chat_id}" + (f" (тема {topic_id})" if topic_id else ""))
            except Exception as chat_error:
                # Обрабатываем конкретно ошибку отправки в чат
                error_text = str(chat_error)
                await message.edit_text(
                    f"❌ Не удалось отправить сообщение: {error_text}\n\n"
                    f"Вероятные причины:\n"
                    f"1. Бот не добавлен в указанный чат\n"
                    f"2. ID чата неверный\n"
                    f"3. У бота нет прав для отправки сообщений\n"
                    f"4. ID темы неверный\n\n"
                    f"Используйте /setchat для установки правильного ID чата"
                )
                
                # Если ошибка связана с отсутствием чата, сбрасываем ID чата
                if "Chat not found" in error_text:
                    self.config["telegram_chat_id"] = None
                    self.save_config()
                    logger.warning(f"ID чата сброшен из-за ошибки: {error_text}")
                    await update.message.reply_text(
                        "⚠️ ID чата был сброшен. Используйте /setchat для установки нового ID."
                    )
                
        except Exception as e:
            await message.edit_text(
                f"❌ Не удалось подготовить тестовое сообщение: {str(e)}"
            )

    async def error_handler(self, update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик ошибок"""
        logger.error(f"Ошибка при обработке обновления {update}: {context.error}")

    async def run(self) -> None:
        """Запуск бота"""
        await self.setup()
        
        # Запускаем бесконечный цикл для поддержания работы бота
        try:
            # Ждем завершения в бесконечном цикле
            while True:
                await asyncio.sleep(1)
        except (KeyboardInterrupt, SystemExit):
            # Обработка Ctrl+C и системных сигналов завершения
            logger.info("Получен сигнал завершения работы")
        finally:
            # Завершаем работу бота
            logger.info("Завершение работы бота...")
            await self.application.updater.stop()
            await self.application.stop()
            await self.application.shutdown()
            logger.info("Бот остановлен")

if __name__ == "__main__":
    try:
        bot = APIMonitorBot()
        asyncio.run(bot.run())
    except Exception as e:
        logger.error(f"Ошибка при запуске бота: {e}") 