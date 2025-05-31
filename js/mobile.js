(function() {
    // Ждем полной загрузки страницы
    document.addEventListener('DOMContentLoaded', function() {
        initMobileMenu();
        initMobileSearch();
        initAnchorLinks();
        initSwipeDetection();
        initInputOptimizations();
        initScrollEffects();
    });

    // Инициализация поиска для мобильных устройств
    function initMobileSearch() {
        const searchForm = document.getElementById('search-form');
        const resultsContainer = document.getElementById('results-container');
        
        if (!searchForm) return;
        
        // Фокус на поле ввода при клике на форму
        const inputs = searchForm.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('click', function() {
this.focus();
});
});
    }

    // Инициализация плавного скролла при клике на якорные ссылки
    function initAnchorLinks() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                    
                    // Добавляем класс для подсветки элемента
                    targetElement.classList.add('highlight');
                    setTimeout(() => {
                        targetElement.classList.remove('highlight');
                    }, 2000);
}
});
});
}

    // Инициализация мобильного меню
    function initMobileMenu() {
        const menuBar = document.getElementById('Menu-bar');
        const menuClose = document.getElementById('close');
        const menuData = document.querySelector('.menu-data');
        
        if (menuBar && menuData) {
            menuBar.addEventListener('click', function() {
                menuData.classList.add('active');
            });
        }
        
        if (menuClose && menuData) {
            menuClose.addEventListener('click', function() {
                menuData.classList.remove('active');
            });
        }
    }

    // Обнаружение свайпов для закрытия меню
    function initSwipeDetection() {
        const menuData = document.querySelector('.menu-data');
        if (!menuData) return;
        
        let touchStartX = 0;
        
        menuData.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
}, { passive: true });
        
        menuData.addEventListener('touchend', function(e) {
            const touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            
            // Если свайп влево, закрываем меню
            if (diff > 50) {
                menuData.classList.remove('active');
}
        }, { passive: true });
}

    // Оптимизация ввода в поля формы
function initInputOptimizations() {
        const phoneInput = document.getElementById('phone');
        const errorMessage = document.querySelector('.error-message');
        
        if (phoneInput) {
            phoneInput.addEventListener('input', function(e) {
                // Удаляем все нецифровые символы
                let value = e.target.value.replace(/\D/g, '');
                
                // Проверяем валидность номера
                if (/^\d{10,15}$/.test(value)) {
if (errorMessage) {
                        errorMessage.style.display = 'none';
                    }
                    phoneInput.classList.remove('invalid');
} else {
if (errorMessage) {
                        errorMessage.style.display = 'block';
                    }
                    if (value.length > 3) {
                        phoneInput.classList.add('invalid');
                    }
}
});
}
}

    // Эффекты при прокрутке
function initScrollEffects() {
        if ('IntersectionObserver' in window) {
            const options = {
                rootMargin: '0px',
threshold: 0.1
};
            
const observer = new IntersectionObserver((entries, observer) => {
entries.forEach(entry => {
if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, options);
            
            // Наблюдаем за элементами с классом animate
            document.querySelectorAll('.animate').forEach(el => {
observer.observe(el);
});
}
        
        // Кнопка "наверх"
        window.addEventListener('scroll', function() {
            if (window.scrollY > 500) {
                if (!document.querySelector('.scroll-top-button')) {
                    const scrollButton = document.createElement('button');
                    scrollButton.className = 'scroll-top-button';
                    scrollButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
                    scrollButton.setAttribute('aria-label', 'Наверх');
                    
                    scrollButton.addEventListener('click', function() {
                        window.scrollTo({
                            top: 0,
                            behavior: 'smooth'
});
});
                    
document.body.appendChild(scrollButton);
                    
                    // Анимация появления
setTimeout(() => {
                        scrollButton.classList.add('visible');
                    }, 10);
                }
            } else {
                const scrollButton = document.querySelector('.scroll-top-button');
if (scrollButton) {
                    scrollButton.classList.remove('visible');
                    
                    // Удаляем кнопку после завершения анимации
                    setTimeout(() => {
                        if (scrollButton.parentNode) {
                            scrollButton.parentNode.removeChild(scrollButton);
                        }
                    }, 300);
                }
            }
        });
    }

    // Проверка, поддерживает ли устройство сенсорный ввод
    function isTouchDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
}
})();