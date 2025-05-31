#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import logging

# Настраиваем логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Определяем директорию, из которой запущен скрипт
script_dir = os.path.dirname(os.path.abspath(__file__))
logger.info(f"Директория запуска: {script_dir}")

# Выводим информацию о структуре директории для отладки
try:
    logger.info(f"Содержимое текущей директории: {os.listdir('.')}")
    if os.path.exists("bot"):
        logger.info(f"Содержимое директории bot: {os.listdir('bot')}")
except Exception as e:
    logger.error(f"Ошибка при чтении директории: {e}")

# Добавляем путь к директории бота в sys.path, если нужно
if script_dir not in sys.path:
    sys.path.append(script_dir)

try:
    # Импортируем и запускаем бота
    from bot.main import APIMonitorBot
    import asyncio
    
    logger.info("Запуск бота...")
    
    # Запуск бота
    bot = APIMonitorBot()
    asyncio.run(bot.run())
    
except ImportError as e:
    logger.error(f"Ошибка импорта: {e}")
    logger.error("Проверьте структуру директорий и наличие файла bot/main.py")
except Exception as e:
    logger.error(f"Общая ошибка: {e}")
    import traceback
    logger.error(traceback.format_exc()) 