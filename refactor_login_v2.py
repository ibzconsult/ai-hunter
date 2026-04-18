"""
Estrategia final login/register:
- Code nodes Validate escapam aspas simples (SQL-safe)
- Postgres nodes usam interpolacao string direta (sem queryReplacement)
- Query unica no login com comparacao inline crypt
"""
import json

BASE = 'C:/Projetos/ibusiness - Prospector IA'
WF_PATH = f'{BASE}/workflow.json'
PG_CRED = {"id": "lQ3Xej7oOL2U8Fbm", "name": "Prospector PG"}


NEW_LOGIN_VALIDATE = {
    "parameters": {
        "jsCode": (
            "const { body } = $input.first().json;\n"
            "const rawEmail = (body.email || '').toString().toLowerCase().trim();\n"
            "const rawPassword = (body.password || '').toString();\n"
            "if (!rawEmail || !rawPassword) {\n"
            "    return [{ json: { success: false, error: 'Email e senha obrigatorios' } }];\n"
            "}\n"
            "// SQL-escape: duplicate single quotes\n"
            "const email = rawEmail.replace(/'/g, \"''\");\n"
            "const password = rawPassword.replace(/'/g, \"''\");\n"
            "return [{ json: { email, password, action: 'login' } }];\n"
        )
    },
    "id": "auth-login-code",
    "name": "Login: Validate",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [560, 640]
}

NEW_LOGIN_QUERY = {
    "parameters": {
        "operation": "executeQuery",
        "query": (
            "SELECT id, nome_empresa, email, produtos_servicos, icp, diferenciais, "
            "tom_abordagem, proposta_valor, mensagem_padrao, openai_api_key, serpapi_key, "
            "(senha_hash = crypt('{{ $json.password }}', senha_hash)) AS password_ok "
            "FROM prospector_tenants "
            "WHERE email = '{{ $json.email }}' AND is_active = true "
            "LIMIT 1"
        ),
        "options": {}
    },
    "id": "auth-login-query-v2",
    "name": "Login: Auth Query",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.5,
    "position": [800, 640],
    "credentials": {"postgres": PG_CRED},
    "alwaysOutputData": True
}


NEW_REGISTER_VALIDATE = {
    "parameters": {
        "jsCode": (
            "const { body } = $input.first().json;\n"
            "const nome = (body.nome_empresa || '').toString().trim();\n"
            "const rawEmail = (body.email || '').toString().toLowerCase().trim();\n"
            "const rawPassword = (body.password || '').toString();\n"
            "const rawTel = (body.telefone || '').toString().trim();\n"
            "if (!nome || !rawEmail || !rawPassword) {\n"
            "    return [{ json: { success: false, error: 'Preencha todos os campos obrigatorios' } }];\n"
            "}\n"
            "if (rawPassword.length < 6) {\n"
            "    return [{ json: { success: false, error: 'Senha deve ter no minimo 6 caracteres' } }];\n"
            "}\n"
            "const esc = s => s.replace(/'/g, \"''\");\n"
            "return [{ json: {\n"
            "    nome_empresa: esc(nome),\n"
            "    email: esc(rawEmail),\n"
            "    password: esc(rawPassword),\n"
            "    telefone: esc(rawTel),\n"
            "    action: 'register'\n"
            "} }];\n"
        )
    },
    "id": "auth-register-code",
    "name": "Register: Validate",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [560, 400]
}

NEW_REGISTER_INSERT = {
    "parameters": {
        "operation": "executeQuery",
        "query": (
            "INSERT INTO prospector_tenants "
            "(nome_empresa, email, senha_hash, telefone) "
            "VALUES ("
            "'{{ $json.nome_empresa }}', "
            "'{{ $json.email }}', "
            "crypt('{{ $json.password }}', gen_salt('bf')), "
            "'{{ $json.telefone }}') "
            "RETURNING id, nome_empresa, email"
        ),
        "options": {}
    },
    "id": "auth-register-pg",
    "name": "Register: Insert",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.5,
    "position": [800, 400],
    "credentials": {"postgres": PG_CRED},
    "onError": "continueRegularOutput",
    "alwaysOutputData": True
}


def ensure_node(wf, node):
    for i, n in enumerate(wf['nodes']):
        if n.get('id') == node['id'] or n.get('name') == node['name']:
            wf['nodes'][i] = node
            return 'updated'
    wf['nodes'].append(node)
    return 'added'


def main():
    with open(WF_PATH, 'r', encoding='utf-8') as f:
        wf = json.load(f)

    for node in [NEW_LOGIN_VALIDATE, NEW_LOGIN_QUERY, NEW_REGISTER_VALIDATE, NEW_REGISTER_INSERT]:
        r = ensure_node(wf, node)
        print(f"  [{r}] {node['name']}")

    with open(WF_PATH, 'w', encoding='utf-8') as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
    print("[ok] workflow.json gravado")


if __name__ == '__main__':
    main()
