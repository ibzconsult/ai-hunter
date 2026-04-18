import json

with open('C:/Projetos/ibusiness - Prospector IA/workflow.json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

for node in wf['nodes']:
    if node['name'] == 'HTML':
        code = node['parameters']['jsCode']
        prefix = 'const html = '
        start = code.index(prefix) + len(prefix)
        end = code.rindex('";\nreturn')
        html = json.loads(code[start:end+1])

        # 1. Remove iframe breaker code (causes errors in sandboxed iframes)
        old_iframe = """// Adicione no in\u00edcio do seu JavaScript, antes de qualquer outra coisa:

// Detectar se est\u00e1 em iframe e tentar quebrar
if (window.self !== window.top) {
    try {
        // Tentar quebrar o iframe (s\u00f3 funciona se mesmo dom\u00ednio)
        window.top.location = window.self.location;
    } catch (e) {
        console.log('Detectado iframe, adaptando funcionalidades...');

        // Fallback para localStorage se estiver em iframe
        // localStorage handled by safeStorage wrapper
    }
}

// Fun\u00e7\u00e3o para bypass CORS em iframe
function createCorsProxy(url) {
    const proxies = [
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://api.allorigins.win/get?url=',
        'https://corsproxy.io/?',
        'https://cors-proxy.htmldriven.com/?url='
    ];

    return proxies[0] + encodeURIComponent(url);
}

// Wrapper para fetch que funciona em iframe
async function safeFetch(url, options = {}) {
    try {
        return await fetch(url, options);
    } catch (error) {
        if (error.message.includes('CORS') || error.message.includes('blocked')) {
            console.log('CORS detectado, usando proxy...');
            return await fetch(createCorsProxy(url), {
                ...options,
                method: 'GET' // Proxies geralmente s\u00f3 suportam GET
            });
        }
        throw error;
    }
}"""

        html = html.replace(old_iframe, "// ibusiness Prospector por IA")

        # 2. Remove the IIFE theme applier
        old_theme_iife = """// Apply theme immediately to prevent flash
        (function () {
            var savedTheme = 'dark';
            document.documentElement.setAttribute('data-bs-theme', savedTheme);
            console.log(`\ud83c\udfa8 Tema aplicado imediatamente: ${savedTheme}`);
        })();"""

        html = html.replace(old_theme_iife, "// Dark theme always")

        # 3. Wrap entire main JS in a try-catch to see errors
        # Actually, better: wrap in DOMContentLoaded (it already is at the bottom)
        # The problem might be that functions are defined inside event listeners

        # Let's check: are functions defined at global scope or inside DOMContentLoaded?
        # They should be at global scope for onclick handlers to work
        # DOMContentLoaded only calls init()

        # 4. Check if there's an error in the IIFE theme block or early code
        # Remove the loadThemeFromStorage function that references safeStorage
        old_theme_load = """function loadThemeFromStorage() {
            var savedTheme = safeStorage.getItem('prospecta_ia_theme') || 'dark';
            var themeIcon = document.getElementById('theme-icon');

            debugLog(`Atualizando \u00edcone para tema: ${savedTheme}`);

            if (themeIcon) {
                if (savedTheme === 'dark') {
                    themeIcon.className = 'bi bi-moon';
                } else {
                    themeIcon.className = 'bi bi-sun';
                }
            }

            document.documentElement.setAttribute('data-bs-theme', savedTheme);
        }"""

        html = html.replace(old_theme_load, "function loadThemeFromStorage() { document.documentElement.setAttribute('data-bs-theme', 'dark'); }")

        # 5. Remove theme toggle function
        old_toggle = """function toggleTheme() {
            var html = document.documentElement;

            if (html.getAttribute('data-bs-theme') === 'light') {
                setTheme('dark');
            } else {
                setTheme('light');
            }
        }"""

        html = html.replace(old_toggle, "function toggleTheme() { /* disabled - always dark */ }")

        # 6. Simplify setTheme
        old_set_theme = """function setTheme(theme) {
            var html = document.documentElement;
            var themeIcon = document.getElementById('theme-icon');

            html.setAttribute('data-bs-theme', theme);

            if (themeIcon) {
                if (theme === 'dark') {
                    themeIcon.className = 'bi bi-moon';
                } else {
                    themeIcon.className = 'bi bi-sun';
                }
            }

            safeStorage.setItem('prospecta_ia_theme', theme);
            debugLog(`Tema alterado para: ${theme}`);
        }"""

        html = html.replace(old_set_theme, "function setTheme(theme) { document.documentElement.setAttribute('data-bs-theme', 'dark'); }")

        # 7. Verify the final state
        print(f"iframe breaker removed: {'window.top.location = window.self.location' not in html}")
        print(f"Theme IIFE removed: {'Tema aplicado imediatamente' not in html}")
        print(f"doLogin exists: {'function doLogin' in html}")

        # Re-encode
        new_html_json = json.dumps(html, ensure_ascii=False)
        new_code = prefix + new_html_json + ';\nreturn [{ json: { html } }];'
        node['parameters']['jsCode'] = new_code
        break

with open('C:/Projetos/ibusiness - Prospector IA/workflow.json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

# Also write clean HTML for local testing
for node in wf['nodes']:
    if node['name'] == 'HTML':
        code = node['parameters']['jsCode']
        prefix = 'const html = '
        start = code.index(prefix) + len(prefix)
        end = code.rindex('";\nreturn')
        html = json.loads(code[start:end+1])
        with open(f'{BASE}/test_output.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print("Wrote test_output.html")
        break

print("DONE")
