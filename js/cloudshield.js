(function() {
const CONFIG = {
CHECK_INTERVAL: 2000,
CLICK_RATE_LIMIT: 15,
CLICK_RATE_INTERVAL: 5000,
API_RATE_LIMIT: 5,
API_RATE_INTERVAL: 60000,
BLOCK_DURATION: 300000,
ENABLE_LOGGING: false
};

let state = {
clickCount: 0,
clickStartTime: Date.now(),
apiRequestCount: 0,
apiRequestStartTime: Date.now(),
isBlocked: false,
blockStartTime: 0,
suspiciousActivity: 0
};

function init() {
checkPreviousBlock();
setupEventListeners();
startPeriodicCheck();
        logEvent('CloudShield initialized');
    }

    function checkPreviousBlock() {
        const blockData = localStorage.getItem('refind_block_until');
        if (blockData) {
            const blockUntil = parseInt(blockData, 10);
            if (blockUntil > Date.now()) {
                block('Предыдущая блокировка продолжается');
            } else {
                localStorage.removeItem('refind_block_until');
}
}
    }

function setupEventListeners() {
        document.addEventListener('click', checkClickRateLimit);
        document.addEventListener('submit', handleFormSubmit);
        
const originalFetch = window.fetch;
window.fetch = function(url, options) {
            if (typeof url === 'string' && url.includes('/api/')) {
if (checkApiRateLimit()) {
                    return originalFetch(url, options);
                } else {
                    return Promise.reject(new Error('Превышен лимит запросов API'));
                }
            }
            return originalFetch(url, options);
        };
        
        window.addEventListener('mousemove', checkSuspiciousActivity);
        document.addEventListener('keydown', checkSuspiciousActivity);
        
preventAutomatedAccess();
}

function preventAutomatedAccess() {
        const honeyPot = document.createElement('div');
        honeyPot.style.position = 'absolute';
        honeyPot.style.left = '-9999px';
        honeyPot.style.opacity = '0';
        honeyPot.innerHTML = '<input type="text" name="website" class="bot-trap">';
        honeyPot.classList.add('bot-protection');
document.body.appendChild(honeyPot);
        
        const honeyInput = honeyPot.querySelector('input');
        if (honeyInput) {
            honeyInput.addEventListener('change', function() {
if (this.value) {
                    block('Обнаружен автоматизированный доступ');
}
            });
}
}

function handleFormSubmit(e) {
if (state.isBlocked) {
e.preventDefault();
return false;
}
        
const form = e.target;
        if (form && form.tagName === 'FORM') {
            const csrfToken = form.querySelector('input[name="csrf_token"]');
if (csrfToken && !validateCsrfToken(csrfToken.value)) {
e.preventDefault();
                block('Недействительный CSRF-токен');
                return false;
            }
        }
return true;
}

    function validateCsrfToken(token) {
        return token && token.length > 16;
    }

    function checkClickRateLimit(e) {
        if (state.isBlocked) return;
        
        const now = Date.now();
        
        if (now - state.clickStartTime > CONFIG.CLICK_RATE_INTERVAL) {
            state.clickCount = 1;
            state.clickStartTime = now;
        } else {
            state.clickCount++;
            if (state.clickCount > CONFIG.CLICK_RATE_LIMIT) {
                block('Слишком много кликов за короткий период');
                return false;
            }
        }
        
        return true;
    }

    function checkApiRateLimit() {
        if (state.isBlocked) return false;
        
        const now = Date.now();
        
        if (now - state.apiRequestStartTime > CONFIG.API_RATE_INTERVAL) {
            state.apiRequestCount = 1;
            state.apiRequestStartTime = now;
            return true;
        } else {
            state.apiRequestCount++;
            if (state.apiRequestCount > CONFIG.API_RATE_LIMIT) {
                block('Превышен лимит запросов API');
return false;
}
        }
        
        return true;
    }

function checkSuspiciousActivity() {
if (state.isBlocked) return;
        
state.suspiciousActivity++;
if (state.suspiciousActivity > 15) {
            startPeriodicCheck();
        }
    }

    function startPeriodicCheck() {
        setInterval(() => {
            state.suspiciousActivity = 0;
        }, CONFIG.CHECK_INTERVAL);
    }

    function block(reason) {
        logEvent('Блокировка доступа: ' + reason);
state.isBlocked = true;
state.blockStartTime = Date.now();
        
const blockUntil = state.blockStartTime + CONFIG.BLOCK_DURATION;
        localStorage.setItem('refind_block_until', blockUntil.toString());
        
        showBlockMessage(reason, CONFIG.BLOCK_DURATION / 1000);
        
        setTimeout(() => {
            unblock();
        }, CONFIG.BLOCK_DURATION);
    }

    function unblock() {
state.isBlocked = false;
        localStorage.removeItem('refind_block_until');
        
        const blockMessage = document.getElementById('cloudshield-block-message');
if (blockMessage && blockMessage.parentNode) {
blockMessage.parentNode.removeChild(blockMessage);
}
        
state.clickCount = 0;
state.clickStartTime = Date.now();
state.apiRequestCount = 0;
state.apiRequestStartTime = Date.now();
state.suspiciousActivity = 0;
}

    function showBlockMessage(reason, seconds) {
        const oldMessage = document.getElementById('cloudshield-block-message');
        if (oldMessage) oldMessage.remove();
        
        const blockDiv = document.createElement('div');
        blockDiv.id = 'cloudshield-block-message';
        blockDiv.style.position = 'fixed';
        blockDiv.style.top = '0';
        blockDiv.style.left = '0';
        blockDiv.style.right = '0';
        blockDiv.style.bottom = '0';
        blockDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        blockDiv.style.color = 'white';
        blockDiv.style.textAlign = 'center';
        blockDiv.style.display = 'flex';
        blockDiv.style.flexDirection = 'column';
        blockDiv.style.justifyContent = 'center';
        blockDiv.style.alignItems = 'center';
        blockDiv.style.zIndex = '10000';
        blockDiv.style.fontFamily = 'Arial, sans-serif';
        blockDiv.style.padding = '20px';
        
        blockDiv.innerHTML = `
            <h2>Доступ временно заблокирован</h2>
            <p>${reason}</p>
            <p>Повторите попытку через <span id="cloudshield-timer">${seconds}</span> секунд</p>
        `;
        
        document.body.appendChild(blockDiv);
        
const timerInterval = setInterval(() => {
            const timerElement = document.getElementById('cloudshield-timer');
            if (!timerElement) {
                clearInterval(timerInterval);
                return;
}
            
            const remaining = parseInt(timerElement.textContent, 10) - 1;
            timerElement.textContent = remaining;
            
if (remaining <= 0) {
clearInterval(timerInterval);
unblock();
}
}, 1000);
}

function logEvent(message) {
if (!CONFIG.ENABLE_LOGGING) return;
        
        const timestamp = new Date().toISOString();
        const logData = {
            timestamp,
            message,
            userAgent: navigator.userAgent
        };
        
        const logs = JSON.parse(localStorage.getItem('refind_security_logs') || '[]');
        logs.push(logData);
        
        if (logs.length > 100) {
            logs.shift();
        }
        
        localStorage.setItem('refind_security_logs', JSON.stringify(logs));
}

init();
})();