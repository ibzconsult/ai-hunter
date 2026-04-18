"""
Refatora login em 1 query parametrizada + 1 code respond.
Substitui Login: Query, Login: Prepare, Login: Verify Password, Login: Respond
por Login: Auth Query (parametrizada) + Login: Respond (avalia).
"""
import json

BASE = 'C:/Projetos/ibusiness - Prospector IA'
WF_PATH = f'{BASE}/workflow.json'
PG_CRED = {"id": "lQ3Xej7oOL2U8Fbm", "name": "Prospector PG"}


NEW_AUTH_QUERY = {
    "parameters": {
        "operation": "executeQuery",
        "query": (
            "SELECT id, nome_empresa, email, produtos_servicos, icp, diferenciais, "
            "tom_abordagem, proposta_valor, mensagem_padrao, openai_api_key, serpapi_key, "
            "(senha_hash = crypt($2, senha_hash)) AS password_ok "
            "FROM prospector_tenants "
            "WHERE email = $1 AND is_active = true "
            "LIMIT 1"
        ),
        "options": {
            "queryReplacement": "={{ $json.email }},={{ $json.password }}"
        }
    },
    "id": "auth-login-query-v2",
    "name": "Login: Auth Query",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.5,
    "position": [800, 640],
    "credentials": {"postgres": PG_CRED},
    "alwaysOutputData": True
}

NEW_RESPOND = {
    "parameters": {
        "jsCode": (
            "const row = $input.first().json;\n"
            "if (!row || !row.id) {\n"
            "    return [{ json: { success: false, error: 'Email ou senha incorretos' } }];\n"
            "}\n"
            "if (row.password_ok !== true) {\n"
            "    return [{ json: { success: false, error: 'Email ou senha incorretos' } }];\n"
            "}\n"
            "return [{ json: {\n"
            "    success: true,\n"
            "    tenant: {\n"
            "        id: row.id,\n"
            "        nome_empresa: row.nome_empresa,\n"
            "        email: row.email,\n"
            "        produtos_servicos: row.produtos_servicos || '',\n"
            "        icp: row.icp || '',\n"
            "        diferenciais: row.diferenciais || '',\n"
            "        tom_abordagem: row.tom_abordagem || 'consultivo',\n"
            "        proposta_valor: row.proposta_valor || '',\n"
            "        mensagem_padrao: row.mensagem_padrao || '',\n"
            "        openai_api_key: row.openai_api_key || '',\n"
            "        serpapi_key: row.serpapi_key || ''\n"
            "    }\n"
            "} }];"
        )
    },
    "id": "auth-login-respond-v2",
    "name": "Login: Respond",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [1040, 640]
}


def main():
    with open(WF_PATH, 'r', encoding='utf-8') as f:
        wf = json.load(f)

    obsolete_ids = {'auth-login-pg', 'auth-login-check', 'auth-login-verify'}
    obsolete_names = {'Login: Query', 'Login: Prepare', 'Login: Verify Password'}

    kept = []
    removed = []
    for n in wf['nodes']:
        if n.get('id') in obsolete_ids or n.get('name') in obsolete_names:
            removed.append(n['name'])
            continue
        kept.append(n)
    wf['nodes'] = kept
    print(f"  [removed] {removed}")

    def ensure_node(node):
        for i, n in enumerate(wf['nodes']):
            if n.get('name') == node['name'] or n.get('id') == node['id']:
                wf['nodes'][i] = node
                return 'updated'
        wf['nodes'].append(node)
        return 'added'

    r1 = ensure_node(NEW_AUTH_QUERY)
    r2 = ensure_node(NEW_RESPOND)
    print(f"  [{r1}] Login: Auth Query")
    print(f"  [{r2}] Login: Respond")

    conns = wf['connections']
    for k in list(conns.keys()):
        if k in obsolete_names:
            del conns[k]

    conns['Login: Validate'] = {"main": [[{"node": "Login: Auth Query", "type": "main", "index": 0}]]}
    conns['Login: Auth Query'] = {"main": [[{"node": "Login: Respond", "type": "main", "index": 0}]]}
    conns['Login: Respond'] = {"main": [[{"node": "Auth Response", "type": "main", "index": 0}]]}

    print("  [ok] conexoes refatoradas")

    with open(WF_PATH, 'w', encoding='utf-8') as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
    print("[ok] workflow.json gravado")


if __name__ == '__main__':
    main()
