document.addEventListener('DOMContentLoaded', function() {
    setupAPIEndpoints();
    setupAPIExamples();
    setupLanguageTabs();
    setupEndpointAnimations();
    setupScrollToEndpoint();
});

function setupAPIEndpoints() {
    const toggleButtons = document.querySelectorAll('.endpoint-toggle');
    const copyButtons = document.querySelectorAll('.copy-code');
    
toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const endpointDetails = this.closest('.endpoint').querySelector('.endpoint-details');
            const isExpanded = endpointDetails.style.maxHeight !== '0px' && endpointDetails.style.maxHeight !== '';
            
if (isExpanded) {
                endpointDetails.style.maxHeight = '0px';
                this.textContent = 'Развернуть';
                setTimeout(() => {
                    if (endpointDetails.style.maxHeight === '0px') {
                        endpointDetails.style.display = 'none';
                    }
                }, 300);
            } else {
                endpointDetails.style.display = 'block';
endpointDetails.offsetHeight;
                endpointDetails.style.maxHeight = endpointDetails.scrollHeight + 'px';
                this.textContent = 'Свернуть';
            }
        });
    });
    
copyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const codeBlock = this.closest('.code-block').querySelector('code');
if (!codeBlock) return;
            
navigator.clipboard.writeText(codeBlock.textContent)
.then(() => {
const originalText = this.textContent;
                    this.textContent = 'Скопировано!';
                    
                    setTimeout(() => {
                        this.textContent = originalText;
                    }, 2000);
                })
                .catch(() => {
                    // Обработка ошибки копирования
});
});
});
}

function setupAPIExamples() {
    const exampleTabs = document.querySelectorAll('.example-tab');
    
    exampleTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            const parentContainer = this.closest('.examples-container');
            
if (!parentContainer) return;
            
            parentContainer.querySelectorAll('.example-tab').forEach(t => {
                t.classList.remove('active');
});
            
            parentContainer.querySelectorAll('.example-content').forEach(content => {
                content.classList.remove('active');
});
            
            this.classList.add('active');
            parentContainer.querySelector(`.example-content[data-tab="${tabId}"]`).classList.add('active');
});
});
}

function setupLanguageTabs() {
    const languageTabs = document.querySelectorAll('.language-tab');
    
    languageTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const language = this.getAttribute('data-lang');
            const parentSection = this.closest('.code-section');
            
if (!parentSection) return;
            
            parentSection.querySelectorAll('.language-tab').forEach(t => {
                t.classList.remove('active');
});
            
            parentSection.querySelectorAll('.code-block').forEach(block => {
                block.classList.remove('active');
});
            
            this.classList.add('active');
            parentSection.querySelector(`.code-block[data-lang="${language}"]`).classList.add('active');
});
});
    
    document.querySelectorAll('.code-section').forEach(section => {
        const firstTab = section.querySelector('.language-tab');
if (firstTab) {
firstTab.click();
}
});
}

function setupEndpointAnimations() {
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
if (!isMobile) {
const fadeObserver = new IntersectionObserver((entries) => {
entries.forEach(entry => {
if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.2,
            rootMargin: '0px 0px 100px 0px'
        });
        
        document.querySelectorAll('.endpoint').forEach(endpoint => {
fadeObserver.observe(endpoint);
});
} else {
        document.querySelectorAll('.endpoint').forEach(endpoint => {
            endpoint.classList.add('visible');
});
}
}

function setupScrollToEndpoint() {
    const endpointLinks = document.querySelectorAll('.endpoint-link');
    
    endpointLinks.forEach(link => {
        link.addEventListener('click', function(e) {
e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (!targetElement) return;
            
            window.scrollTo({
                top: targetElement.offsetTop - 100,
                behavior: 'smooth'
});
            
            document.querySelectorAll('.highlight-endpoint').forEach(el => {
                el.classList.remove('highlight-endpoint');
});
            
            targetElement.classList.add('highlight-endpoint');
            setTimeout(() => {
                targetElement.classList.remove('highlight-endpoint');
}, 2000);
});
});
}