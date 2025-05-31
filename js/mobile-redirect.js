(function() {
function getCookie(name) {
        const cookieArray = document.cookie.split(';');
        for (let i = 0; i < cookieArray.length; i++) {
            const cookiePair = cookieArray[i].split('=');
if (name === cookiePair[0].trim()) {
return decodeURIComponent(cookiePair[1]);
}
}
return null;
}

function setCookie(name, value, daysToExpire) {
const date = new Date();
date.setTime(date.getTime() + (daysToExpire * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
    }

    function removeCookie(name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/`;
    }

    const mobilePatterns = [
        /android/i, /webos/i, /iphone/i, /ipad/i, /ipod/i,
/blackberry/i, /windows phone/i, /iemobile/i,
/opera mini/i, /opera mobi/i, /mobile/i, /tablet/i,
/touch/i, /samsung/i, /nokia/i, /lg-/i,
/xiaomi/i, /oppo/i, /vivo/i, /meizu/i, /redmi/i,
/mi /i, /honor/i, /poco/i, /realme/i, /oneplus/i
];

const whitelistedDevices = [
/ipad pro/i, /tablet pc/i, /surface pro/i, /surface book/i,
/macbook/i, /chromebook/i, /laptop/i
];

function isMobileDevice() {
const userAgent = navigator.userAgent.toLowerCase();
        
for (let i = 0; i < whitelistedDevices.length; i++) {
if (whitelistedDevices[i].test(userAgent)) {
                return false;
            }
        }
        
        for (let i = 0; i < mobilePatterns.length; i++) {
            if (mobilePatterns[i].test(userAgent)) {
                return true;
            }
        }
        
        const hasTouchScreen = ('ontouchstart' in window) || 
(navigator.maxTouchPoints > 0) ||
(navigator.msMaxTouchPoints > 0);
            
const screenAspectRatio = window.screen.width / window.screen.height;
const isMobileRatio = (screenAspectRatio < 0.7 || screenAspectRatio > 1.7);
        
const isMobileScreen = window.screen.width <= 1024 && window.screen.height <= 1366;
        
if (hasTouchScreen && (isMobileRatio || isMobileScreen)) {
return true;
}
        
return false;
}

const isMobile = isMobileDevice();

if (!isMobile) {
        setCookie('mobile_redirect_bypassed', 'true', 7);
} else {
        setCookie('mobile_detected', 'true', 1);
}

if (isMobile) {
        const deviceInfo = {
            screen: {
                width: window.screen.width,
                height: window.screen.height,
ratio: (window.screen.width / window.screen.height).toFixed(2),
pixel_ratio: window.devicePixelRatio
},
referrer: document.referrer
};
        
        localStorage.setItem('device_info', JSON.stringify(deviceInfo));
}

    window.addEventListener('DOMContentLoaded', function() {
        if (getCookie('mobile_redirect_bypassed') === 'true') {
return;
}
        
        fetch('/mobile-detect', {
            method: 'GET',
headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
},
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.mobile && data.redirect) {
                window.location.replace('/mobile-blocked');
            }
        })
        .catch(err => {
});
});

window.MobileRedirect = {
isMobile: isMobileDevice,
bypass: function(enable = true) {
if (enable) {
                setCookie('mobile_redirect_bypassed', 'true', 7);
                removeCookie('mobile_detected');
}
return enable;
},
getDeviceInfo: function() {
return {
userAgent: navigator.userAgent,
screen: {
width: window.screen.width,
height: window.screen.height,
ratio: (window.screen.width / window.screen.height).toFixed(2),
                    orientation: window.screen.orientation?.type || 'unknown'
                },
                touchEnabled: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
isMobile: isMobileDevice()
};
}
};
})();