document.addEventListener('DOMContentLoaded', function() {
    // Инициализация компонентов новостной страницы
    setupNewsFeed();
    setupFilters();
    setupNewsSearch();
    setupLazyLoading();
    setupSharingButtons();
});

// Настройка новостной ленты и анимации
function setupNewsFeed() {
    const newsCards = document.querySelectorAll('.news-card');
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Анимация появления новостных карточек при прокрутке
    if (!isMobile && 'IntersectionObserver' in window) {
        const newsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
newsObserver.unobserve(entry.target);
}
});
}, {
threshold: 0.1,
            rootMargin: '0px 0px 50px 0px'
        });
        
        newsCards.forEach(card => {
            newsObserver.observe(card);
});
}
    
    // Обработка клика по карточке
newsCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // Если клик не по кнопке или ссылке внутри карточки
            if (!e.target.closest('button') && !e.target.closest('.share-button')) {
                const newsLink = card.querySelector('.news-link');
if (newsLink) {
                    const href = newsLink.getAttribute('href');
                    if (href) {
                        window.location.href = href;
                    }
                }
            }
        });
    });
}

// Настройка фильтров по категориям
function setupFilters() {
    const newsCards = document.querySelectorAll('.news-card');
    const filterButtons = document.querySelectorAll('.filter-button');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Удаляем активный класс со всех кнопок
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Добавляем активный класс к нажатой кнопке
            this.classList.add('active');
            
            const category = this.getAttribute('data-category');
            
            // Если выбрана категория "все", показываем все карточки
            if (category === 'all') {
                newsCards.forEach(card => {
                    card.style.display = 'block';
                    card.style.opacity = '0';
                    
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 10);
                });
            } else {
                // Иначе фильтруем карточки по категории
newsCards.forEach(card => {
                    const cardCategory = card.getAttribute('data-category');
                    
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    
                    setTimeout(() => {
if (cardCategory === category) {
                            card.style.display = 'block';
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        } else {
                            card.style.display = 'none';
                        }
}, 300);
});
}
});
});
    
    // Активируем фильтр "Все" по умолчанию
    const allFilter = document.querySelector('.filter-button[data-category="all"]');
    if (allFilter) {
        allFilter.click();
}
}

// Настройка поиска по новостям
function setupNewsSearch() {
    const newsCards = document.querySelectorAll('.news-card');
    const searchInput = document.getElementById('news-search');
    const noResultsMessage = document.getElementById('no-results');
    let searchTimeout;
    
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
clearTimeout(searchTimeout);
        
searchTimeout = setTimeout(() => {
const searchTerm = this.value.toLowerCase().trim();
let foundResults = false;
            
            // Если поисковая строка пуста, показываем все новости
            if (searchTerm === '') {
                newsCards.forEach(card => {
                    card.style.display = 'block';
                    card.style.opacity = '0';
                    
setTimeout(() => {
                        card.style.opacity = '1';
                    }, 10);
                });
                
                if (noResultsMessage) {
                    noResultsMessage.style.display = 'none';
}
return;
}
            
            // Фильтруем карточки по поисковому запросу
newsCards.forEach(card => {
                const title = card.querySelector('.news-title')?.textContent.toLowerCase() || '';
                const description = card.querySelector('.news-description')?.textContent.toLowerCase() || '';
                const content = (title + ' ' + description);
                
                // Проверяем, содержит ли карточка поисковый запрос
                if (content.includes(searchTerm)) {
                    foundResults = true;
                    card.style.display = 'block';
                    card.style.opacity = '0';
                    
setTimeout(() => {
                        card.style.opacity = '1';
                    }, 10);
                } else {
setTimeout(() => {
                        card.style.display = 'none';
                    }, 300);
                    card.style.opacity = '0';
                }
            });
            
            // Показываем сообщение, если ничего не найдено
            if (noResultsMessage) {
                noResultsMessage.style.display = foundResults ? 'none' : 'block';
            }
            
            // Подсвечиваем найденный текст
            const highlighted = document.querySelectorAll('.highlight');
highlighted.forEach(el => {
el.outerHTML = el.textContent;
});
            
const highlightElement = (element) => {
if (!element) return;
const html = element.innerHTML;
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                element.innerHTML = html.replace(regex, '<span class="highlight">$1</span>');
            };
            
            // Подсвечиваем текст в заголовках и описаниях
            newsCards.forEach(card => {
                if (card.style.display !== 'none') {
                    highlightElement(card.querySelector('.news-title'));
                    highlightElement(card.querySelector('.news-description'));
}
            });
        }, 300);
    });
}

// Настройка ленивой загрузки изображений
function setupLazyLoading() {
    if ('IntersectionObserver' in window) {
        const lazyImages = document.querySelectorAll('.lazy-image');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const lazyImage = entry.target;
                    if (lazyImage.dataset.src) {
                        lazyImage.src = lazyImage.dataset.src;
                        lazyImage.removeAttribute('data-src');
                    }
                    lazyImage.classList.remove('lazy-image');
                    imageObserver.unobserve(lazyImage);
                }
            });
        });
        
lazyImages.forEach(img => {
            imageObserver.observe(img);
        });
    } else {
        // Для браузеров без поддержки IntersectionObserver
        const lazyImages = document.querySelectorAll('.lazy-image');
        
        const lazyLoad = function() {
lazyImages.forEach(img => {
if (img.getBoundingClientRect().top <= window.innerHeight &&
img.getBoundingClientRect().bottom >= 0 &&
                    getComputedStyle(img).display !== 'none') {
                    
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
}
                    img.classList.remove('lazy-image');
                    
                    // Если все изображения загружены, удаляем обработчики событий
                    if (document.querySelectorAll('.lazy-image').length === 0) {
                        document.removeEventListener('scroll', lazyLoad);
                        window.removeEventListener('resize', lazyLoad);
                        window.removeEventListener('orientationchange', lazyLoad);
}
                }
            });
        };
        
lazyLoad();
        document.addEventListener('scroll', lazyLoad, { passive: true });
        window.addEventListener('resize', lazyLoad);
        window.addEventListener('orientationchange', lazyLoad);
    }
}

// Настройка кнопок "Поделиться"
function setupSharingButtons() {
    const shareButtons = document.querySelectorAll('.share-button');
    
shareButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            const newsCard = this.closest('.news-card');
if (!newsCard) return;
            
            const title = newsCard.querySelector('.news-title')?.textContent || 'Новость ReFind';
            const url = newsCard.querySelector('.news-link')?.href || window.location.href;
            
            // Проверяем поддержку Web Share API
            if (navigator.share) {
                navigator.share({
                    title: title,
                    url: url
                }).catch(() => {
                    // Если Web Share API не сработал, используем запасной вариант
showShareFallback(title, url);
});
} else {
showShareFallback(title, url);
}
});
});
}

// Запасной вариант для "Поделиться" - копирование ссылки
function showShareFallback(title, url) {
navigator.clipboard.writeText(url).then(() => {
        const notification = document.createElement('div');
        notification.className = 'share-notification';
        notification.textContent = 'Ссылка скопирована в буфер обмена';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        setTimeout(() => {
            notification.style.opacity = '0';
setTimeout(() => {
document.body.removeChild(notification);
}, 300);
}, 2000);
    }).catch(() => {
        // Обработка ошибки при копировании
    });
}