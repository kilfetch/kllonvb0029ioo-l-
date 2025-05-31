#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import logging

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def debug_env():
    """Функция для отладки окружения и структуры директорий"""
    # Информация о Python
    logger.info(f"Python версия: {sys.version}")
    logger.info(f"Python путь: {sys.executable}")
    logger.info(f"Python sys.path: {sys.path}")
    
    # Информация о текущей директории
    cwd = os.getcwd()
    logger.info(f"Текущая рабочая директория: {cwd}")
    
    # Информация о содержимом директории
    try:
        files = os.listdir(cwd)
        logger.info(f"Файлы в текущей директории: {files}")
        
        # Проверяем важные поддиректории
        dirs_to_check = ['bot', 'js']
        for dir_name in dirs_to_check:
            dir_path = os.path.join(cwd, dir_name)
            if os.path.exists(dir_path):
                logger.info(f"Содержимое директории {dir_name}: {os.listdir(dir_path)}")
            else:
                logger.warning(f"Директория {dir_name} не найдена")
                
        # Проверяем файлы конфигурации
        config_paths = [
            os.path.join(cwd, 'bot', 'config.json'),
            os.path.join(cwd, 'js', 'config.js'),
            os.path.join(cwd, 'requirements.txt')
        ]
        
        for path in config_paths:
            if os.path.exists(path):
                logger.info(f"Файл найден: {path}")
                
                # Если это текстовый файл, показываем его содержимое
                if path.endswith(('.txt', '.json', '.js')):
                    try:
                        with open(path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            logger.info(f"Содержимое файла {path}:\n{content}")
                    except Exception as e:
                        logger.error(f"Ошибка при чтении файла {path}: {e}")
            else:
                logger.warning(f"Файл не найден: {path}")
        
    except Exception as e:
        logger.error(f"Ошибка при чтении директории: {e}")
    
    # Информация о переменных окружения
    logger.info(f"Переменные окружения:")
    for key, value in os.environ.items():
        logger.info(f"  {key}: {value}")

if __name__ == "__main__":
    logger.info("Запуск скрипта отладки...")
    debug_env()
    logger.info("Отладка завершена") 