(function() {
    // Загружаем шрифт для подсветки кода
function loadFonts() {
        if (!document.querySelector('link[href*="JetBrains+Mono"]')) {
            const fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap';
            document.head.appendChild(fontLink);
        }
    }
    
    // Инициализация подсветки синтаксиса
    function initSyntaxHighlighting() {
        const codeBlocks = document.querySelectorAll('pre code');
        
        if (codeBlocks.length === 0) {
            console.debug('Блоки кода для подсветки не найдены');
            return;
        }
        
        loadFonts();
        
        codeBlocks.forEach(codeBlock => {
            highlightSyntax(codeBlock);
        });
    }
    
    // Функция подсветки синтаксиса в блоке кода
    function highlightSyntax(codeBlock) {
        let code = codeBlock.textContent;
        
        // Экранируем HTML-символы
        code = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // Получаем язык из класса блока кода
        const lang = codeBlock.className.match(/language-([a-z0-9]+)/i);
        const language = lang ? lang[1].toLowerCase() : 'plaintext';
        
        // Выполняем подсветку в зависимости от языка
        let highlighted = '';
        
        if (language === 'json' || language === 'javascript' || language === 'js') {
            highlighted = highlightJavaScript(code);
        } else if (language === 'html') {
            highlighted = highlightHTML(code);
        } else if (language === 'css') {
            highlighted = highlightCSS(code);
        } else if (language === 'python' || language === 'py') {
            highlighted = highlightPython(code);
        } else {
            highlighted = code; // Без подсветки
        }
        
        // Добавляем нумерацию строк
        highlighted = addLineNumbers(highlighted);
        
        // Обновляем содержимое блока с подсвеченным кодом
        codeBlock.innerHTML = highlighted;
        
        // Добавляем элементы для копирования кода
        addCopyButton(codeBlock);
    }
    
    // Подсветка синтаксиса JavaScript/JSON
    function highlightJavaScript(code) {
        let highlighted = code;
        
        // Определяем шаблоны для замены
        const patterns = [
            // Строки
            { regex: /("(?:\\.|[^"\\])*")/g, replacement: '<span class="string">$1</span>' },
            { regex: /('(?:\\.|[^'\\])*')/g, replacement: '<span class="string">$1</span>' },
            
            // Ключевые слова
            { regex: /\b(const|let|var|function|return|if|else|for|while|break|continue|new|this|class|extends|import|export|try|catch|throw)\b/g, 
              replacement: '<span class="keyword">$1</span>' },
            
            // Константы
            { regex: /\b(true|false|null|undefined)\b/g, replacement: '<span class="constant">$1</span>' },
            
            // Числа
            { regex: /\b(\d+(\.\d+)?)\b/g, replacement: '<span class="number">$1</span>' },
            
            // Комментарии
            { regex: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, replacement: '<span class="comment">$1</span>' },
            
            // Функции
            { regex: /\b([a-zA-Z_$][\w$]*)\s*\(/g, replacement: '<span class="function">$1</span>(' }
        ];
        
        // Применяем шаблоны
        patterns.forEach(pattern => {
            highlighted = highlighted.replace(pattern.regex, pattern.replacement);
        });
        
        return highlighted;
    }
    
    // Подсветка синтаксиса HTML
    function highlightHTML(code) {
        let highlighted = code;
        
        // Определяем шаблоны для замены
        const patterns = [
            // Теги
            { regex: /(&lt;\/?[a-z][a-z0-9]*(?:\s+[a-z][a-z0-9]*(?:=(?:"[^"]*"|'[^']*'|[^\s'"&gt;]+))?)*\s*\/?\s*&gt;)/gi, 
              replacement: '<span class="tag">$1</span>' },
            
            // Атрибуты
            { regex: /(\s+[a-z][a-z0-9]*=)(?:"([^"]*)"|'([^']*)'|([^\s'"&gt;]+))/gi, 
              replacement: '<span class="attr">$1</span>"<span class="string">$2$3$4</span>"' },
            
            // Комментарии
            { regex: /(&lt;!--[\s\S]*?--&gt;)/g, replacement: '<span class="comment">$1</span>' }
        ];
        
        // Применяем шаблоны
        patterns.forEach(pattern => {
            highlighted = highlighted.replace(pattern.regex, pattern.replacement);
        });
        
        return highlighted;
    }
    
    // Подсветка синтаксиса CSS
    function highlightCSS(code) {
        let highlighted = code;
        
        // Определяем шаблоны для замены
        const patterns = [
            // Селекторы
            { regex: /([a-z0-9_\-\.#\*\:]+\s*\{)/gi, replacement: '<span class="selector">$1</span>' },
            
            // Свойства
            { regex: /(\s*[a-z\-]+\s*:)/gi, replacement: '<span class="property">$1</span>' },
            
            // Значения
            { regex: /(:.*?;)/g, replacement: '<span class="value">$1</span>' },
            
            // Комментарии
            { regex: /(\/\*[\s\S]*?\*\/)/g, replacement: '<span class="comment">$1</span>' }
        ];
        
        // Применяем шаблоны
        patterns.forEach(pattern => {
            highlighted = highlighted.replace(pattern.regex, pattern.replacement);
        });
        
        return highlighted;
    }
    
    // Подсветка синтаксиса Python
    function highlightPython(code) {
        let highlighted = code;
        
        // Определяем шаблоны для замены
        const patterns = [
            // Строки
            { regex: /("(?:\\.|[^"\\])*")/g, replacement: '<span class="string">$1</span>' },
            { regex: /('(?:\\.|[^'\\])*')/g, replacement: '<span class="string">$1</span>' },
            
            // Ключевые слова
            { regex: /\b(def|class|import|from|as|return|if|elif|else|for|while|break|continue|try|except|finally|raise|with|in|not|and|or|is|None|True|False|pass|lambda)\b/g, 
              replacement: '<span class="keyword">$1</span>' },
            
            // Числа
            { regex: /\b(\d+(\.\d+)?)\b/g, replacement: '<span class="number">$1</span>' },
            
            // Комментарии
            { regex: /(#[^\n]*)/g, replacement: '<span class="comment">$1</span>' },
            
            // Функции
            { regex: /\b(def\s+)([a-zA-Z_][a-zA-Z0-9_]*)/g, replacement: '<span class="keyword">$1</span><span class="function">$2</span>' },
            
            // Классы
            { regex: /\b(class\s+)([a-zA-Z_][a-zA-Z0-9_]*)/g, replacement: '<span class="keyword">$1</span><span class="class">$2</span>' }
        ];
        
        // Применяем шаблоны
patterns.forEach(pattern => {
highlighted = highlighted.replace(pattern.regex, pattern.replacement);
});
        
        return highlighted;
    }
    
    // Добавление нумерации строк
    function addLineNumbers(code) {
        const lines = code.split('\n');
        let numberedCode = '<table class="code-table"><tbody>';
        
        lines.forEach((line, index) => {
            numberedCode += `
                <tr>
                    <td class="line-number">${index + 1}</td>
                    <td class="line-content">${line || ' '}</td>
                </tr>`;
        });
        
        numberedCode += '</tbody></table>';
        return numberedCode;
    }
    
    // Добавление кнопки копирования
    function addCopyButton(codeBlock) {
        const container = codeBlock.parentNode;
        
        if (!container.querySelector('.copy-code-button')) {
            const button = document.createElement('button');
            button.className = 'copy-code-button';
            button.textContent = 'Копировать';
            button.setAttribute('type', 'button');
            
            button.addEventListener('click', function() {
                const code = codeBlock.textContent;
                navigator.clipboard.writeText(code).then(() => {
                    button.textContent = 'Скопировано!';
                    setTimeout(() => {
                        button.textContent = 'Копировать';
                    }, 2000);
                }).catch(err => {
                    button.textContent = 'Ошибка';
                    setTimeout(() => {
                        button.textContent = 'Копировать';
                    }, 2000);
                });
            });
            
            container.insertBefore(button, codeBlock);
        }
    }
    
    // Запускаем подсветку синтаксиса после загрузки страницы
    document.addEventListener('DOMContentLoaded', initSyntaxHighlighting);
    
    // Добавляем стили для подсветки
    function addSyntaxHighlightingStyles() {
        if (!document.getElementById('syntax-highlight-styles')) {
            const style = document.createElement('style');
            style.id = 'syntax-highlight-styles';
            style.textContent = `
                pre {
                    position: relative;
                    background-color: #f5f5f5;
                    border-radius: 4px;
                    padding: 1em;
                    margin: 1em 0;
                    overflow: auto;
                }
                
                .code-table {
                    border-collapse: collapse;
                    width: 100%;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 14px;
                }
                
                .line-number {
                    color: #999;
                    text-align: right;
                    padding-right: 1em;
                    user-select: none;
                    vertical-align: top;
                    border-right: 1px solid #ddd;
                    width: 1%;
                    white-space: nowrap;
                }
                
                .line-content {
                    padding-left: 1em;
                    white-space: pre;
                }
                
                .copy-code-button {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    padding: 4px 8px;
                    background-color: #f0f0f0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    z-index: 1;
                }
                
                .copy-code-button:hover {
                    background-color: #e0e0e0;
                }
                
                .string { color: #d14; }
                .keyword { color: #07a; }
                .constant { color: #905; }
                .number { color: #099; }
                .comment { color: #998; font-style: italic; }
                .function { color: #900; }
                .tag { color: #170; }
                .attr { color: #00c; }
                .selector { color: #170; }
                .property { color: #00c; }
                .value { color: #d14; }
                .class { color: #b06; }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Добавляем стили при загрузке страницы
    document.addEventListener('DOMContentLoaded', addSyntaxHighlightingStyles);
})();