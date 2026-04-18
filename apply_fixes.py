"""
Aplica correções ao node HTML do workflow Prospector IA:
  1. safeStorage sem recursão (usa localStorage nativo)
  2. getAuthWebhookBase usa window.location.href direto (sem heurística 'webhook')
  3. Regrava workflow.json + test_output.html sincronizados
"""
import json
import os

BASE = 'C:/Projetos/ibusiness - Prospector IA'
WF_PATH = f'{BASE}/workflow.json'
HTML_PATH = f'{BASE}/test_output.html'

SAFE_STORAGE_OLD = """// Safe storage wrapper for sandboxed iframes
        var safeStorage = (function() {
            var memStore = {};
            var useLocal = false;
            try {
                safeStorage.setItem('_test', '1');
                safeStorage.removeItem('_test');
                useLocal = true;
            } catch(e) {
                useLocal = false;
            }
            return {
                getItem: function(k) { return useLocal ? safeStorage.getItem(k) : (memStore[k] || null); },
                setItem: function(k, v) { if (useLocal) safeStorage.setItem(k, v); else memStore[k] = v; },
                removeItem: function(k) { if (useLocal) safeStorage.removeItem(k); else delete memStore[k]; }
            };
        })();"""

SAFE_STORAGE_NEW = """// Safe storage wrapper for sandboxed iframes
        var safeStorage = (function() {
            var memStore = {};
            var useLocal = false;
            try {
                window.localStorage.setItem('_sstest', '1');
                window.localStorage.removeItem('_sstest');
                useLocal = true;
            } catch(e) {
                useLocal = false;
            }
            return {
                getItem: function(k) {
                    try { return useLocal ? window.localStorage.getItem(k) : (memStore[k] || null); }
                    catch(e) { return memStore[k] || null; }
                },
                setItem: function(k, v) {
                    try { if (useLocal) window.localStorage.setItem(k, v); else memStore[k] = v; }
                    catch(e) { memStore[k] = v; }
                },
                removeItem: function(k) {
                    try { if (useLocal) window.localStorage.removeItem(k); else delete memStore[k]; }
                    catch(e) { delete memStore[k]; }
                }
            };
        })();"""

AUTH_BASE_OLD = """function getAuthWebhookBase() {
            // Try multiple strategies to find the correct webhook URL
            // 1. If we have a known webhook URL from the page load
            if (window._webhookUrl) return window._webhookUrl;

            // 2. Try window.location (works if not in iframe)
            var loc = window.location.origin + window.location.pathname.replace(/\\/+$/, '');
            if (loc && loc.indexOf('webhook') !== -1) {
                window._webhookUrl = loc;
                return loc;
            }

            // 3. Try parent location (if in iframe, same origin)
            try {
                if (window.parent && window.parent.location) {
                    var ploc = window.parent.location.origin + window.parent.location.pathname.replace(/\\/+$/, '');
                    if (ploc.indexOf('webhook') !== -1) {
                        window._webhookUrl = ploc;
                        return ploc;
                    }
                }
            } catch(e) {}

            // 4. Try document.referrer
            if (document.referrer && document.referrer.indexOf('webhook') !== -1) {
                var ref = document.referrer.replace(/\\/+$/, '');
                window._webhookUrl = ref;
                return ref;
            }

            // 5. Fallback: use current location anyway
            window._webhookUrl = loc;
            return loc;
        }"""

AUTH_BASE_NEW = """function getAuthWebhookBase() {
            // HTML is served by the same webhook URL that handles POST actions.
            // fetch('') posts to window.location.href; we use explicit URL for clarity.
            if (window._webhookUrl) return window._webhookUrl;
            try {
                var url = window.location.href.split('?')[0].split('#')[0].replace(/\\/+$/, '');
                window._webhookUrl = url;
                return url;
            } catch(e) {
                return '';
            }
        }"""


SAVE_CONFIG_OLD = """            safeStorage.setItem('webhook_config', JSON.stringify({
                url: webhookUrl
            }));

            updateSearchButtonState();
            updateWebhookButtons();"""

SAVE_CONFIG_NEW = """            safeStorage.setItem('webhook_config', JSON.stringify({
                url: webhookUrl
            }));

            // Persist keys to server so the tenant profile stays in sync
            if (typeof syncProfileToServer === 'function') {
                syncProfileToServer();
            }

            updateSearchButtonState();
            updateWebhookButtons();"""


LOAD_INSTANCES_OLD = """        function loadInstances() {
            const saved = safeStorage.getItem('whatsapp_instances');
            if (saved) {
                try { whatsappInstances = JSON.parse(saved); } catch(e) { whatsappInstances = []; }
            }
            renderInstances();
        }"""

LOAD_INSTANCES_NEW = """        async function loadInstances() {
            // Cache from safeStorage first (instant UI)
            const saved = safeStorage.getItem('whatsapp_instances');
            if (saved) {
                try { whatsappInstances = JSON.parse(saved); } catch(e) { whatsappInstances = []; }
            }
            renderInstances();

            // Then refresh from server (source of truth)
            if (!currentTenant || !currentTenant.id) return;
            try {
                const resp = await fetch(getAuthWebhookBase() || '', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'list_instances', tenant_id: currentTenant.id })
                });
                const data = await resp.json();
                if (data && data.success && Array.isArray(data.instances)) {
                    whatsappInstances = data.instances.map(function(i) {
                        return {
                            db_id: i.id,
                            label: i.label || '',
                            url: i.uazapi_url,
                            token: i.instance_token,
                            status: i.status || 'disconnected',
                            qrcode: null
                        };
                    });
                    safeStorage.setItem('whatsapp_instances', JSON.stringify(whatsappInstances));
                    renderInstances();
                }
            } catch(e) { debugLog('Erro ao carregar instancias do servidor:', e); }
        }"""


REMOVE_INSTANCE_OLD = """        function removeInstance(index) {
            if (!confirm('Remover esta instância?')) return;
            whatsappInstances.splice(index, 1);
            saveInstances();
            showSuccessToast('Instância removida');
        }"""

REMOVE_INSTANCE_NEW = """        async function removeInstance(index) {
            if (!confirm('Remover esta instância?')) return;
            const inst = whatsappInstances[index];
            if (inst && inst.db_id && currentTenant && currentTenant.id) {
                try {
                    await fetch(getAuthWebhookBase() || '', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'delete_instance',
                            tenant_id: currentTenant.id,
                            instance_id: inst.db_id
                        })
                    });
                } catch(e) { debugLog('Erro delete instancia:', e); }
            }
            whatsappInstances.splice(index, 1);
            saveInstances();
            showSuccessToast('Instância removida');
        }"""


CREATE_INSTANCE_PUSH_OLD = """                if (data.success && data.instance) {
                    whatsappInstances.push({
                        label: label,
                        url: data.instance.url,
                        token: data.instance.token,
                        status: data.instance.status || 'disconnected',
                        qrcode: data.instance.qrcode || null
                    });"""

CREATE_INSTANCE_PUSH_NEW = """                if (data.success && data.instance) {
                    whatsappInstances.push({
                        db_id: data.instance.db_id || null,
                        label: label,
                        url: data.instance.url,
                        token: data.instance.token,
                        status: data.instance.status || 'disconnected',
                        qrcode: data.instance.qrcode || null
                    });"""


ENTER_APP_OLD = """            // Re-init
            updateSearchButtonState();
            updateWebhookButtons();
            if (miniMap) miniMap.invalidateSize();
        }"""

ENTER_APP_NEW = """            // Re-init
            updateSearchButtonState();
            updateWebhookButtons();
            if (miniMap) miniMap.invalidateSize();

            // Reload instances from server now that we have a tenant
            if (typeof loadInstances === 'function') loadInstances();
        }"""


QUOTE_BUG_1_OLD = """'Configure sua API Key SerpAPI em 'Meu Negócio'.'"""
QUOTE_BUG_1_NEW = """'Configure sua API Key SerpAPI em "Meu Negócio".'"""


def patch_html(html: str) -> str:
    count = 0
    if SAFE_STORAGE_OLD in html:
        html = html.replace(SAFE_STORAGE_OLD, SAFE_STORAGE_NEW)
        count += 1
        print("  [OK] safeStorage corrigido")
    else:
        print("  [SKIP] safeStorage ja corrigido ou variante desconhecida")

    if AUTH_BASE_OLD in html:
        html = html.replace(AUTH_BASE_OLD, AUTH_BASE_NEW)
        count += 1
        print("  [OK] getAuthWebhookBase corrigido")
    else:
        print("  [SKIP] getAuthWebhookBase ja corrigido ou variante desconhecida")

    if SAVE_CONFIG_OLD in html:
        html = html.replace(SAVE_CONFIG_OLD, SAVE_CONFIG_NEW)
        count += 1
        print("  [OK] saveAllConfigs agora persiste no servidor")
    else:
        print("  [SKIP] saveAllConfigs ja corrigido ou variante desconhecida")

    if LOAD_INSTANCES_OLD in html:
        html = html.replace(LOAD_INSTANCES_OLD, LOAD_INSTANCES_NEW)
        count += 1
        print("  [OK] loadInstances busca do servidor")
    else:
        print("  [SKIP] loadInstances ja corrigido")

    if REMOVE_INSTANCE_OLD in html:
        html = html.replace(REMOVE_INSTANCE_OLD, REMOVE_INSTANCE_NEW)
        count += 1
        print("  [OK] removeInstance deleta no servidor")
    else:
        print("  [SKIP] removeInstance ja corrigido")

    if CREATE_INSTANCE_PUSH_OLD in html:
        html = html.replace(CREATE_INSTANCE_PUSH_OLD, CREATE_INSTANCE_PUSH_NEW)
        count += 1
        print("  [OK] createAndConnectInstance captura db_id")
    else:
        print("  [SKIP] createAndConnectInstance ja corrigido")

    if ENTER_APP_OLD in html:
        html = html.replace(ENTER_APP_OLD, ENTER_APP_NEW)
        count += 1
        print("  [OK] enterApp recarrega instancias pos-login")
    else:
        print("  [SKIP] enterApp ja corrigido")

    # Bug de sintaxe: aspas simples nao escapadas
    bug_count = html.count(QUOTE_BUG_1_OLD)
    if bug_count > 0:
        html = html.replace(QUOTE_BUG_1_OLD, QUOTE_BUG_1_NEW)
        count += bug_count
        print(f"  [OK] {bug_count} bug(s) de aspas simples corrigidos")
    else:
        print("  [SKIP] aspas simples ja corrigidas")

    print(f"  Total patches aplicados: {count}")
    return html


def main():
    with open(WF_PATH, 'r', encoding='utf-8') as f:
        wf = json.load(f)

    for node in wf['nodes']:
        if node['name'] == 'HTML':
            code = node['parameters']['jsCode']
            prefix = 'const html = '
            start = code.index(prefix) + len(prefix)
            end = code.rindex('";\nreturn')
            html = json.loads(code[start:end + 1])

            print("Patch no workflow.json (node HTML):")
            html = patch_html(html)

            new_html_json = json.dumps(html, ensure_ascii=False)
            node['parameters']['jsCode'] = prefix + new_html_json + ';\nreturn [{ json: { html } }];'

            with open(HTML_PATH, 'w', encoding='utf-8') as f:
                f.write(html)
            print(f"[OK] test_output.html regravado ({len(html)} bytes)")
            break

    with open(WF_PATH, 'w', encoding='utf-8') as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
    print(f"[OK] workflow.json regravado")


if __name__ == '__main__':
    main()
