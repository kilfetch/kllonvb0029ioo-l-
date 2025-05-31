(function() {
let networkNotificationTimer = null;
    
    // Инициализация всех компонентов после загрузки страницы
    document.addEventListener('DOMContentLoaded', function() {
        initNavbar();
        initModals();
        initNotifications();
        animatePageLoad();
        enhanceFormInputs();
        setupNetworkStatusHandling();
    });
    
    // Обработка изменений статуса сети
    function setupNetworkStatusHandling() {
        // Слушаем пользовательские события изменения статуса сети
        document.addEventListener('network-status-change', function(event) {
if (event.detail.online) {
hideOfflineNotification();
                showNotification('Соединение восстановлено', 5000);
} else {
showOfflineNotification();
}
});
        
        // Слушаем события изменения статуса сети браузера
        window.addEventListener('online', function() {
            showNotification('Соединение восстановлено', 10000);
            document.dispatchEvent(new CustomEvent('network-status-change', { detail: { online: true } }));
});
        
        window.addEventListener('offline', function() {
showOfflineNotification();
            document.dispatchEvent(new CustomEvent('network-status-change', { detail: { online: false } }));
});
}
    
    // Показать уведомление об отсутствии сети
function showOfflineNotification() {
        showNotification('Отсутствует подключение к сети', 0, 'offline-notification');
}
    
    // Скрыть уведомление об отсутствии сети
function hideOfflineNotification() {
        const offlineNotification = document.getElementById('offline-notification');
        if (offlineNotification) {
            offlineNotification.classList.add('hiding');
            setTimeout(() => {
                if (offlineNotification.parentNode) {
                    offlineNotification.parentNode.removeChild(offlineNotification);
                }
            }, 300);
}
    }
    
    // Инициализация системы уведомлений
function initNotifications() {
        // Создаем контейнер для уведомлений, если его еще нет
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
document.body.appendChild(container);
        }
        
        // Добавляем стили для уведомлений, если их еще нет
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                #notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }
                .notification {
                    background-color: rgba(50, 50, 50, 0.9);
                    color: white;
                    padding: 12px 20px;
                    margin-bottom: 10px;
                    border-radius: 6px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                    opacity: 0;
                    transform: translateX(30px);
                    transition: opacity 0.3s, transform 0.3s;
                    max-width: 300px;
                }
                .notification.showing {
                    opacity: 1;
                    transform: translateX(0);
                }
                .notification.hiding {
                    opacity: 0;
                    transform: translateX(30px);
                }
                #offline-notification {
                    background-color: rgba(220, 53, 69, 0.9);
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Показать уведомление
    function showNotification(message, duration = 5000, id = null) {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = 'notification';
        if (id) notification.id = id;
        notification.textContent = message;
        
        // Добавляем уведомление в контейнер
        container.appendChild(notification);
        
        // Анимируем появление
        setTimeout(() => {
            notification.classList.add('showing');
        }, 10);
        
        // Автоматически скрываем уведомление через указанное время
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.add('hiding');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, duration);
        }
    }
    
    // Инициализация навигационной панели
    function initNavbar() {
        const navbar = document.querySelector('.navbar');
if (!navbar) return;
        
        // Обработка прокрутки страницы
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
} else {
                navbar.classList.remove('scrolled');
            }
        });
        
        // Подсвечиваем активный пункт меню
        const menuItems = document.querySelectorAll('.nav-link, .nav-button');
        const currentPath = window.location.pathname;
        
menuItems.forEach(item => {
            const href = item.getAttribute('href');
            if (href && (href === currentPath || (href !== '/' && currentPath.startsWith(href)))) {
                item.classList.add('active');
} else {
                item.classList.remove('active');
            }
        });
    }
    
    // Инициализация модальных окон
    function initModals() {
        const modals = document.querySelectorAll('.modal');
        const modalTriggers = document.querySelectorAll('[data-modal]');
        
        // Обработка закрытия модальных окон
modals.forEach(modal => {
            const closeButton = modal.querySelector('.close-modal');
            if (closeButton) {
                closeButton.addEventListener('click', function() {
                    modal.style.display = 'none';
                });
            }
            
            // Закрытие по клику на фон
            modal.addEventListener('click', function(event) {
if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
            
            // Закрытие по клавише Esc
            document.addEventListener('keydown', function(event) {
                if (event.key === 'Escape' && modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
            });
        });
        
        // Обработка открытия модальных окон
modalTriggers.forEach(trigger => {
            trigger.addEventListener('click', function(e) {
                e.preventDefault();
                const modalId = this.getAttribute('data-modal');
const modal = document.getElementById(modalId);
                
if (modal) {
                    modal.style.display = 'block';
                    
                    // Фокус на первый элемент управления
                    const firstControl = modal.querySelector('button, input, select, textarea');
if (firstControl) {
firstControl.focus();
}
}
});
});
}
    
    // Анимация загрузки страницы
function animatePageLoad() {
        const elementsToAnimate = document.querySelectorAll('.animate-on-load');
        
        elementsToAnimate.forEach((element, index) => {
            setTimeout(() => {
                element.classList.add('visible');
}, index * 150);
});
}
    
    // Улучшение полей формы
function enhanceFormInputs() {
        const inputs = document.querySelectorAll('.form-control, .form-input');
        
        // Обработка фокуса на поля ввода
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.parentElement.classList.add('focused');
            });
            
            input.addEventListener('blur', function() {
if (!this.value) {
                    this.parentElement.classList.remove('focused');
}
            });
            
            // Маскирование ввода телефона
            if (input.type === 'tel' || input.id === 'phone') {
                input.addEventListener('input', function(event) {
                    let value = event.target.value.replace(/\D/g, '');
                    
                    if (value.length > 0) {
                        if (value.length <= 11) {
                            if (value.length === 11) {
                                value = `+${value.substring(0, 1)} (${value.substring(1, 4)}) ${value.substring(4, 7)}-${value.substring(7, 9)}-${value.substring(9, 11)}`;
                            } else if (value.length > 4) {
                                value = `+7 (${value.substring(0, 3)}) ${value.substring(3, 6)}${value.length > 6 ? '-' + value.substring(6, 8) : ''}${value.length > 8 ? '-' + value.substring(8, 10) : ''}`;
                            } else if (value.length > 1) {
                                value = `+7 (${value.substring(0, value.length)}`;
                            } else {
                                value = `+7 (${value}`;
}
                        }
                    }
                    
                    event.target.value = value;
                });
            }
        });
    }
    
    // Проверка доступности сети
    async function checkNetworkStatus() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
            const response = await fetch('https://api.refind.com/health', {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache, no-store, max-age=0',
                    'Pragma': 'no-cache'
                },
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return true;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError' || error.name === 'TypeError') {
                return false;
            }
            
            return false;
        }
    }
})();