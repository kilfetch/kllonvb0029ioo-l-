window.ReFind = window.ReFind || {};
window.ReFind.config = {
    version: '1.0.0',
    
    api_url: 'https://server.refind.website/',
    api_key: '5386c7fd-f568-49f8-a36e-db8d2e705bdc',
    max_results: 10,
    
    _fallback_search_urls: [],
    
    rate_limit: 10,
    max_searches_per_session: 10,
    
    request: {
        timeout: 15000,
        retries: 3,
        delay: 1000,
        use_get: true
    },
    
    telegram: {
        bot_username: 'ReFindBot',
        channel: 'refind_news'
    },
    
    mobile: {
        detection: true,
        redirect: true,
        allowed_devices: ['iPad Pro', 'Surface Pro']
    },
    
    security: {
        cors_headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
        },
        csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.refind.com;"
    },
    
    demo_mode: false
};