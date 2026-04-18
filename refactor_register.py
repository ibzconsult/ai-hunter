"""
Parametriza Register: Insert para evitar SQL injection em senha/nome com aspas.
"""
import json

BASE = 'C:/Projetos/ibusiness - Prospector IA'
WF_PATH = f'{BASE}/workflow.json'
PG_CRED = {"id": "lQ3Xej7oOL2U8Fbm", "name": "Prospector PG"}

NEW_INSERT = {
    "parameters": {
        "operation": "executeQuery",
        "query": (
            "INSERT INTO prospector_tenants "
            "(nome_empresa, email, senha_hash, telefone) "
            "VALUES ($1, $2, crypt($3, gen_salt('bf')), $4) "
            "RETURNING id, nome_empresa, email"
        ),
        "options": {
            "queryReplacement": "={{ $json.nome_empresa }},={{ $json.email }},={{ $json.password }},={{ $json.telefone }}"
        }
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


def main():
    with open(WF_PATH, 'r', encoding='utf-8') as f:
        wf = json.load(f)

    for i, n in enumerate(wf['nodes']):
        if n.get('name') == 'Register: Insert':
            wf['nodes'][i] = NEW_INSERT
            print("  [updated] Register: Insert parametrizado")
            break

    with open(WF_PATH, 'w', encoding='utf-8') as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
    print("[ok] workflow.json gravado")


if __name__ == '__main__':
    main()
