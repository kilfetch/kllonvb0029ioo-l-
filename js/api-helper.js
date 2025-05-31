    window.ReFind = window.ReFind || {};
window.ReFind.api = (function() {
    const API_ENDPOINT = 'https://api.refind.com/v1';
    const MAX_RESULTS = window.ReFind && window.ReFind.config ? window.ReFind.config.max_results || 5 : 5;
    
    // Логгер для отслеживания действий
    const logger = {
        logs: [],
        maxLogs: 100,
        DEBUG: 'debug',
        INFO: 'info',
        WARNING: 'warning',
        ERROR: 'error',
        currentLevel: 'warning',
        
        maskSensitiveData: function(data) {
            const dataStr = (typeof data === 'object') ? JSON.stringify(data) : String(data);
            let masked = dataStr.replace(/(\d{3,})/g, '***');
            masked = masked.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@***.***');
            return masked;
        },
        
        log: function(level, message, data = null) {
            if (
                (this.currentLevel === this.DEBUG) || 
                (this.currentLevel === this.INFO && level !== this.DEBUG) ||
                (this.currentLevel === this.WARNING && (level === this.WARNING || level === this.ERROR)) ||
                (this.currentLevel === this.ERROR && level === this.ERROR)
            ) {
            const timestamp = new Date().toISOString();
            const maskedMessage = this.maskSensitiveData(message);
            const maskedData = data ? this.maskSensitiveData(data) : null;
            const log = {
                timestamp,
                level,
                message: maskedMessage,
                    data: maskedData ? (typeof maskedData === 'object' ? maskedData : maskedData) : null
            };
            this.logs.unshift(log);
            if (this.logs.length > this.maxLogs) {
                this.logs.pop();
            }
                try {
                    localStorage.setItem('refind_logs', JSON.stringify(this.logs));
                } catch(e) {
                    // Ошибка при сохранении логов
                }
            return log;
            }
            return null;
        },
        
        info: function(message, data = null) {
            return this.log(this.INFO, message, data);
        },
        
        warning: function(message, data = null) {
            return this.log(this.WARNING, message, data);
        },
        
        error: function(message, data = null) {
            return this.log(this.ERROR, message, data);
        },
        
        debug: function(message, data = null) {
            return this.log(this.DEBUG, message, data);
        },
        
        getLogs: function() {
            return this.logs;
        },
        
        clearLogs: function() {
            this.logs = [];
            try {
                localStorage.removeItem('refind_logs');
            } catch(e) {
                // Ошибка при удалении логов
            }
            this.clearServerLogs()
                .then(response => {
                    // Очистка завершена
                });
        },
        
        loadLogs: function() {
            try {
                const savedLogs = localStorage.getItem('refind_logs');
                if (savedLogs) {
                    this.logs = JSON.parse(savedLogs);
                }
            } catch(e) {
                // Ошибка при загрузке логов
            }
        },
        
        setLogLevel: function(level) {
            if ([this.DEBUG, this.INFO, this.WARNING, this.ERROR].includes(level)) {
                this.currentLevel = level;
            }
        },
        
        clearServerLogs: async function() {
            try {
                const response = await fetch('/api/logs/clear', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                if (!response.ok) {
                    throw new Error(`HTTP ошибка: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                // Ошибка при очистке логов сервера
                return { success: false, error: error.message };
            }
        }
    };
    
    // Объект для ограничения запросов
    const rateLimiter = {
        maxRequests: window.ReFind && window.ReFind.config ? window.ReFind.config.rate_limit || 10 : 10,
        resetPeriod: 60 * 60 * 1000, // 1 час в миллисекундах
        
        checkLimit: function() {
            try {
                const now = Date.now();
                const limiterData = localStorage.getItem('refind_rate_limiter');
                let limiter = limiterData ? JSON.parse(limiterData) : { 
                    requests: 0, 
                    firstRequestTime: now 
                };
                
                if (now - limiter.firstRequestTime > this.resetPeriod) {
                    limiter = { 
                        requests: 0, 
                        firstRequestTime: now 
                    };
                }
                
                if (limiter.requests >= this.maxRequests) {
                    const remainingTime = Math.ceil((limiter.firstRequestTime + this.resetPeriod - now) / 1000);
                    return {
                        allowed: false,
                        remainingTime: remainingTime,
                        remainingRequests: 0,
                        message: `Лимит запросов исчерпан. Повторите через ${Math.ceil(remainingTime / 60)} мин.`
                    };
                }
                
                limiter.requests++;
                localStorage.setItem('refind_rate_limiter', JSON.stringify(limiter));
                
                return {
                    allowed: true,
                    remainingRequests: this.maxRequests - limiter.requests,
                    remainingTime: Math.ceil((limiter.firstRequestTime + this.resetPeriod - now) / 1000)
                };
            } catch (e) {
                return {
                    allowed: true,
                    remainingRequests: 999,
                    remainingTime: 3600
                };
            }
        },
        
        isLimitReached: function() {
            const limit = this.checkLimit();
            return !limit.allowed;
        },
        
        resetLimit: function() {
            try {
                localStorage.removeItem('refind_rate_limiter');
                return true;
            } catch (e) {
                return false;
            }
        },
        
        getRateLimit: function() {
            try {
                const limiterData = localStorage.getItem('refind_rate_limiter');
                if (!limiterData) {
                    return {
                        allowed: true,
                        remainingRequests: this.maxRequests,
                        remainingTime: this.resetPeriod / 1000
                    };
                }
                
                const now = Date.now();
                const limiter = JSON.parse(limiterData);
                
                if (now - limiter.firstRequestTime > this.resetPeriod) {
                    return {
                        allowed: true,
                        remainingRequests: this.maxRequests,
                        remainingTime: this.resetPeriod / 1000
                    };
                }
                
                const remainingRequests = Math.max(0, this.maxRequests - limiter.requests);
                const remainingTime = Math.ceil((limiter.firstRequestTime + this.resetPeriod - now) / 1000);
                
                return {
                    allowed: remainingRequests > 0,
                    remainingRequests: remainingRequests,
                    remainingTime: remainingTime
                };
            } catch (e) {
                return {
                    allowed: true,
                    remainingRequests: this.maxRequests,
                    remainingTime: this.resetPeriod / 1000
                };
            }
        }
    };
    
    // Обновление информации о лимитах в UI
    function updateLimitInfoInUI(remainingRequests) {
        try {
            const limitIndicators = document.querySelectorAll('.rate-limit-indicator');
            if (limitIndicators && limitIndicators.length > 0) {
                limitIndicators.forEach(indicator => {
                    indicator.innerHTML = `<i class="fas fa-database"></i> <strong>${remainingRequests}</strong>`;
                    if (remainingRequests <= 1) {
                        indicator.classList.add('limit-reached');
                    } else {
                        indicator.classList.remove('limit-reached');
                    }
                });
            }
            
            const limitBadges = document.querySelectorAll('.rate-limit-badge');
            if (limitBadges && limitBadges.length > 0) {
                limitBadges.forEach(item => {
                    item.textContent = remainingRequests;
                    if (remainingRequests <= 1) {
                        item.classList.add('limit-warning');
                    } else {
                        item.classList.remove('limit-warning');
                }
            });
            }
        } catch (e) {
            logger.debug(`Ошибка обновления UI лимитов: ${e.message}`);
        }
    }
    
    // Инициализация лимитов при загрузке
    document.addEventListener('DOMContentLoaded', function() {
        try {
            const currentLimits = rateLimiter.getRateLimit();
            if (currentLimits) {
                updateLimitInfoInUI(currentLimits.remainingRequests);
            }
        } catch(e) {
            logger.debug(`Ошибка инициализации лимитов: ${e.message}`);
        }
    });
    
    // Основная функция для выполнения API запросов
    async function makeApiRequest(endpoint, method = 'GET', data = null, timeout = 15000) {
        try {
            const apiKey = window.ReFind && window.ReFind.config ? window.ReFind.config.api_key : '';
            
            const requestOptions = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin'
            };
            
            if (apiKey) {
                requestOptions.headers['X-API-Key'] = apiKey;
            }
            
            if (data && (method === 'POST' || method === 'PUT')) {
                requestOptions.body = JSON.stringify(data);
                logger.debug(`Данные добавлены в тело запроса`, { dataSize: JSON.stringify(data).length });
            }
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                logger.error(`Таймаут запроса к ${endpoint} (15 сек)`);
            }, timeout);
            
            requestOptions.signal = controller.signal;
            logger.info(`Отправка запроса к ${API_ENDPOINT}${endpoint}`);
            
            const response = await fetch(`${API_ENDPOINT}${endpoint}`, requestOptions);
            clearTimeout(timeoutId);
            
            logger.info(`Получен ответ от ${endpoint} со статусом: ${response.status}`);
            
            if (!response.ok) {
                const errorMessage = `Ошибка HTTP: ${response.status} ${response.statusText}`;
                logger.error(errorMessage, { status: response.status, url: `${API_ENDPOINT}${endpoint}` });
                
                switch(response.status) {
                    case 400:
                        throw new Error('Неверный запрос. Проверьте данные.');
                    case 403:
                        throw new Error('Доступ запрещен. Проверьте API ключ.');
                    case 429:
                        throw new Error('Превышен лимит запросов. Повторите позже.');
                    case 502:
                        throw new Error('Ошибка шлюза. Сервер временно недоступен.');
                    case 504:
                        throw new Error('Таймаут сервера. Повторите запрос позже.');
                    default:
                        throw new Error(`Ошибка сервера: ${response.status}`);
                }
            }
            
            return await response.json();
        } catch (error) {
            const isCorsError = error.name === 'TypeError' && error.message.includes('Failed to fetch');
            const isTimeoutError = error.name === 'AbortError' || error.message.includes('timeout');
            
            if (isCorsError) {
                throw new Error('Ошибка сетевого соединения. Проверьте подключение к интернету.');
            } else if (isTimeoutError) {
                throw new Error('Время ожидания ответа истекло. Сервер не отвечает.');
            }
            
            throw error;
        }
    }
    
    // Функция для тестирования соединения с сервером
    async function testDirectRequest(url, phone, apiKey) {
        logger.info(`Выполняю диагностику доступности API`);
        try {
            const serverUrl = url.split('/').slice(0, 3).join('/');
            const safeTestUrl = `${serverUrl}/health?_=${Date.now()}`;
            
            const promiseTimeout = function(ms, promise) {
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(() => {
                        reject(new Error('Timeout'));
                    }, ms);
                    
                    promise
                        .then(value => {
                            clearTimeout(timer);
                            resolve(value);
                        })
                        .catch(reason => {
                            clearTimeout(timer);
                            reject(reason);
                        });
                });
            };
            
            try {
                const imgPromise = new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(false);
                    img.src = `${safeTestUrl}&_type=test&_nocache=${Date.now()}`;
                });
                
                const result = await promiseTimeout(5000, imgPromise);
                logger.info(`Результат диагностики: сервер ${result ? 'доступен' : 'недоступен'}`);
                
                return { 
                    testedDirectly: true,
                    message: result 
                        ? "Сервер доступен, можно выполнять поиск"
                        : "Сервер недоступен, проверьте соединение"
                };
            } catch(testError) {
                logger.info(`Ошибка при тестировании соединения: ${testError.message}`);
                return {
                    testedDirectly: true,
                    message: "Не удалось проверить доступность сервера: " + testError.message
                };
            }
        } catch(e) {
            logger.error(`Ошибка диагностики: ${e.message}`);
            return {
                testedDirectly: false,
                message: "Ошибка диагностики: " + e.message
            };
        }
    }
    
    // Выполнение JSONP запроса
    function jsonpRequest(url, callback) {
        return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        window[callbackName] = function(data) {
            delete window[callbackName];
                document.body.removeChild(script);
                resolve(data);
                if (typeof callback === 'function') {
                    callback(data);
            }
        };

        const script = document.createElement('script');
            script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
            script.onerror = function(error) {
            delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('Ошибка при загрузке JSONP'));
            };
        document.body.appendChild(script);
        });
    }

    // Генерация тестовых данных для демо-режима
    function generateTestData(phone, count = 3) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const results = [];
                const databases = [
                    "Телефонная база",
                    "База клиентов",
                    "База данных заказов",
                    "База данных пользователей",
                    "Утечка данных 2023"
                ];
                
                for (let i = 0; i < count; i++) {
                    const dbIndex = Math.floor(Math.random() * databases.length);
                    results.push({
                        database: databases[dbIndex],
                        description: `Информация из базы ${databases[dbIndex]}`,
                        data: {
                            phone: phone,
                            name: `Тестовое Имя ${i+1}`,
                            email: `test${i+1}@example.com`
                        }
                    });
                }
                
                resolve({
                    results: results,
                    totalFound: count,
                    execution_time: 0.5,
                    status: "success"
                });
            }, 1500);
        });
    }

    // Обработка номера телефона для поиска
    function normalizePhone(phone) {
        if (!phone) {
            throw new Error('Номер телефона не указан');
        }
        
        // Удаляем все нецифровые символы
        const normalizedPhone = phone.replace(/\D/g, '');
        
        if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
            throw new Error('Неверный формат номера телефона');
        }
        
        if (normalizedPhone.length !== 11) {
            return normalizedPhone;
        }
        
        let finalPhone = normalizedPhone;
        if (normalizedPhone.startsWith('8')) {
            finalPhone = '7' + normalizedPhone.substring(1);
            logger.info(`Номер телефона преобразован из 8 в 7: ${finalPhone.substring(0, 5)}***`);
        }
        
        return finalPhone;
    }

    // Маскирование чувствительных данных для отображения
    function maskSensitiveData(item) {
        const maskedItem = {...item};
        
        // Маскируем телефон
        if (maskedItem.phone) {
            const phone = String(maskedItem.phone);
            if (phone.length > 5) {
                maskedItem.phone = phone.substring(0, 2) + '*'.repeat(phone.length - 3) + phone.slice(-1);
            }
        }
        
        // Маскируем email
        if (maskedItem.email) {
            const email = String(maskedItem.email);
            const parts = email.split('@');
            if (parts.length === 2) {
                if (parts[0].length > 2) {
                    parts[0] = parts[0].charAt(0) + '*'.repeat(parts[0].length - 2) + parts[0].charAt(parts[0].length - 1);
                }
                if (parts[1].indexOf('.') > 0) {
                    const domainParts = parts[1].split('.');
                    domainParts[0] = domainParts[0].charAt(0) + '*'.repeat(domainParts[0].length - 1);
                    parts[1] = domainParts.join('.');
                }
                maskedItem.email = parts.join('@');
            }
        }
        
        // Маскируем имя
        if (maskedItem.name) {
            const name = String(maskedItem.name);
            if (name.length > 2) {
                maskedItem.name = name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
            }
        }
        
        return maskedItem;
    }

    // Проверка, содержит ли запись полезную информацию
    function hasUsefulInfo(record) {
        if (!record) return false;
        
        const usefulFields = ['name', 'phone', 'email', 'address', 'data'];
        const MIN_DATA_LENGTH = 3;
        
        for (const field of usefulFields) {
            if (record[field] && String(record[field]).trim().length >= MIN_DATA_LENGTH) {
                return true;
            }
        }
        
        return false;
    }

    // Функция отображения ошибок поиска
    function displayError(error) {
        const errorMessage = error.message || 'Неизвестная ошибка';
        const errorCode = error.code || 'ERR_UNKNOWN';
        const helpText = error.help || '';
        
        logger.error(`Отображаем ошибку: ${errorMessage} (${errorCode})`, { details: error.details });
        
        // Отображаем ошибку в интерфейсе
        const resultErrorContainers = document.querySelectorAll('.search-error');
        if (resultErrorContainers && resultErrorContainers.length > 0) {
            const resultErrorMessage = resultErrorContainers[0].querySelector('.error-message');
            if (resultErrorMessage) {
                resultErrorMessage.textContent = errorMessage;
                if (helpText) {
                    let helpElement = resultErrorContainers[0].querySelector('.error-help');
                    if (!helpElement) {
                        helpElement = document.createElement('p');
                        helpElement.className = 'error-help';
                        resultErrorContainers[0].appendChild(helpElement);
                    }
                    helpElement.textContent = helpText;
                }
            }
        }
    }

    // Функция для поиска данных по номеру телефона
    async function searchByPhone(phone) {
        try {
                // Проверяем лимит запросов
                const limitCheck = rateLimiter.checkLimit();
                if (!limitCheck.allowed) {
                return { 
                    error: limitCheck.message,
                    results: [],
                    count: 0,
                    totalFound: 0,
                    searchTime: 0,
                    remainingRequests: limitCheck.remainingRequests
                };
            }
            
            // Нормализуем телефон
            const finalPhone = normalizePhone(phone);
            
            // Получаем API ключ
                const apiKey = window.ReFind && window.ReFind.config ? window.ReFind.config.api_key : '';
                
            // Проверяем, включен ли демо-режим
            const isDemoMode = window.ReFind && window.ReFind.config && window.ReFind.config.demo_mode;
            
            // В демо-режиме генерируем тестовые данные
            if (isDemoMode) {
                logger.info('Поиск в демо-режиме');
                const demoResults = await generateTestData(finalPhone, 3);
                return {
                    results: demoResults.results.map(item => maskSensitiveData(item)),
                    count: demoResults.totalFound,
                    totalFound: demoResults.totalFound,
                    visible: demoResults.results.length,
                    searchTime: demoResults.execution_time,
                    remainingRequests: limitCheck.remainingRequests
                };
            }
            
            // Выполняем поиск через API
            const searchEndpoint = `/search?phone=${encodeURIComponent(finalPhone)}`;
            const response = await makeApiRequest(searchEndpoint);
            
            // Обрабатываем ответ
            if (!response.results || response.results.length === 0) {
                        updateLimitInfoInUI(limitCheck.remainingRequests);
                        return { 
                    error: 'Информация не найдена',
                            results: [],
                            count: 0,
                            totalFound: 0,
                            searchTime: 0,
                            remainingRequests: limitCheck.remainingRequests
                        };
                    }
                    
            // Обрабатываем найденные результаты
                        const searchTime = response.execution_time || 0;
                        const allResults = response.results || [];
                        const filteredResults = allResults.filter(hasUsefulInfo);
                        const totalFound = filteredResults.length;
            
                        if (totalFound === 0) {
                            updateLimitInfoInUI(limitCheck.remainingRequests);
                            return { 
                    error: 'Информация не найдена',
                                results: [],
                                count: 0,
                                totalFound: 0,
                                searchTime: 0,
                                remainingRequests: limitCheck.remainingRequests
                            };
                        }
                        
            // Применяем маскирование данных
                        const maxResults = 10;
                        const visibleResults = filteredResults.slice(0, maxResults);
                        const maskedData = visibleResults.map(item => {
                            const masked = maskSensitiveData(item);
                            return {
                                database: masked.database || item.database || 'Неизвестная база',
                    phone: masked.phone || item.phone || finalPhone,
                    name: masked.name || masked.fullname || 'Имя не указано',
                    address: masked.address || 'Адрес не указан',
                    data: masked
                            };
                        });
                        
            // Формируем финальный результат
                        const result = {
                            results: maskedData,
                            count: totalFound,
                            totalFound: totalFound,
                            visible: maskedData.length,
                            searchTime: searchTime,
                            timestamp: Date.now(),
                            request_id: `req_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                            remainingRequests: limitCheck.remainingRequests
                        };
                        
            // Сохраняем результаты поиска
                        window.ReFind.lastSearchResults = result;
                        
            // Обновляем информацию о лимитах
                        updateLimitInfoInUI(limitCheck.remainingRequests);
                        
                        return result;
                } catch (error) {
            logger.error(`Ошибка при поиске: ${error.message}`);
            
            // Отображаем ошибку
            let errorMessage = error.message || 'Ошибка при выполнении поиска';
            let errorCode = error.code || 'ERR_SEARCH';
            
            // Проверяем различные типы ошибок
            const isCorsError = error.name === 'TypeError' && 
                (error.message.includes('Failed to fetch') || 
                 error.message.includes('Network error') ||
                 error.message.includes('CORS'));
            
            const isTimeoutError = error.name === 'AbortError' || 
                                  error.message.toLowerCase().includes('timeout');
            
            if (isCorsError) {
                errorCode = 'ERR_NETWORK';
                errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
            } else if (isTimeoutError) {
                errorCode = 'ERR_TIMEOUT';
                errorMessage = 'Сервер не отвечает. Повторите попытку позже.';
            }
            
            // Отображаем ошибку в интерфейсе
                    displayError({
                        message: errorMessage,
                        code: errorCode,
                details: error.message
            });
            
            // Возвращаем объект с ошибкой
                    return { 
                        error: errorMessage,
                    results: [],
                    count: 0,
                    totalFound: 0,
                    searchTime: 0
                };
            }
    }

    // Возвращаем публичный API
                return {
        search: searchByPhone,
        testConnection: testDirectRequest,
        getRateLimit: rateLimiter.getRateLimit.bind(rateLimiter),
        resetLimit: rateLimiter.resetLimit.bind(rateLimiter),
        logs: {
            get: logger.getLogs.bind(logger),
            clear: logger.clearLogs.bind(logger),
            setLevel: logger.setLogLevel.bind(logger)
        }
    };
})();