(function() {
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Функция для ограничения частоты вызовов
function throttle(func, delay) {
let lastCall = 0;
return function(...args) {
const now = new Date().getTime();
if (now - lastCall < delay) return;
lastCall = now;
return func(...args);
};
}
    
    // Обработчик прокрутки страницы
const handleScroll = throttle(function() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;
        
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
} else {
            navbar.classList.remove('scrolled');
        }
    }, 100);
    
    // Проверка на устройства с низкой производительностью
const isLowPerfDevice = () => {
        // Проверка количества ядер процессора
if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
return true;
}
        
        // Проверка старых версий iOS
        if (/(iPhone|iPad|iPod)/.test(navigator.userAgent) && /OS (8|9|10|11|12)_/.test(navigator.userAgent)) {
            return true;
        }
        
        // Проверка старых устройств Android
        if (/Android (4|5|6)/.test(navigator.userAgent)) {
return true;
}
        
        return false;
    };
    
    // Добавляем оптимизации для мобильных устройств
    function applyMobileOptimizations() {
        if (!isMobile) return;
        
        // Добавляем обработчик прокрутки
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Отключаем некоторые эффекты на устройствах с низкой производительностью
        if (isLowPerfDevice()) {
            document.body.classList.add('low-perf-device');
            
            // Отключаем анимации
            const style = document.createElement('style');
            style.textContent = `
                .animate, .fade-in, .slide-in {
                    animation: none !important;
                    opacity: 1 !important;
                    transform: none !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Оптимизируем загрузку изображений
        document.querySelectorAll('img').forEach(img => {
            if (!img.loading) {
                img.loading = 'lazy';
            }
        });
    }
    
    // Запускаем оптимизации после загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyMobileOptimizations);
    } else {
        applyMobileOptimizations();
    }
})();