"""
Adiciona persistência de instâncias Uazapi no Postgres.

Fluxo novo:
  Route Action (CreateInstance) → Inst: Create → Inst: Save DB → Inst: Create Finalize → Auth Response
  Route Action (ConnectInstance) → Inst: Connect → Inst: Update Connection → Auth Response
  Route Action (InstanceStatus) → Inst: Status → Inst: Update Status → Auth Response

Idempotente: se os novos nodes já existem, apenas atualiza queries.
"""
import json

BASE = 'C:/Projetos/ibusiness - Prospector IA'
WF_PATH = f'{BASE}/workflow.json'
PG_CRED = {"id": "lQ3Xej7oOL2U8Fbm", "name": "Prospector PG"}


NEW_NODES = [
    {
        "parameters": {
            "operation": "executeQuery",
            "query": (
                "INSERT INTO prospector_instances "
                "(tenant_id, label, uazapi_url, instance_token, instance_name, status, uazapi_session_id, last_qr_at) "
                "VALUES ("
                "'{{ $('Route Action').first().json.body.tenant_id }}', "
                "'{{ $json.instance.label }}', "
                "'{{ $json.instance.url }}', "
                "'{{ $json.instance.token }}', "
                "'{{ $json.instance.name }}', "
                "'{{ $json.instance.status }}', "
                "'{{ $json.instance.name }}', "
                "NOW()) "
                "RETURNING id"
            ),
            "options": {}
        },
        "id": "inst-save-db",
        "name": "Inst: Save DB",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [800, 1400],
        "credentials": {"postgres": PG_CRED},
        "onError": "continueRegularOutput",
        "alwaysOutputData": True
    },
    {
        "parameters": {
            "jsCode": (
                "const created = $('Inst: Create').first().json;\n"
                "const db = $input.first().json;\n"
                "if (!created.success) return [{ json: created }];\n"
                "const out = Object.assign({}, created);\n"
                "out.instance = Object.assign({}, created.instance);\n"
                "if (db && db.id) out.instance.db_id = db.id;\n"
                "return [{ json: out }];"
            )
        },
        "id": "inst-create-finalize",
        "name": "Inst: Create Finalize",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1040, 1400]
    },
    {
        "parameters": {
            "operation": "executeQuery",
            "query": (
                "UPDATE prospector_instances SET "
                "status = '{{ $json.status }}', "
                "last_qr_at = NOW(), "
                "disconnected_at = CASE WHEN '{{ $json.status }}' = 'disconnected' THEN NOW() ELSE disconnected_at END "
                "WHERE instance_token = '{{ $('Route Action').first().json.body.token }}' "
                "RETURNING id"
            ),
            "options": {}
        },
        "id": "inst-update-connection",
        "name": "Inst: Update Connection",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [800, 1560],
        "credentials": {"postgres": PG_CRED},
        "onError": "continueRegularOutput",
        "alwaysOutputData": True
    },
    {
        "parameters": {
            "jsCode": (
                "const connect = $('Inst: Connect').first().json;\n"
                "return [{ json: connect }];"
            )
        },
        "id": "inst-connect-finalize",
        "name": "Inst: Connect Finalize",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1040, 1560]
    },
    {
        "parameters": {
            "operation": "executeQuery",
            "query": (
                "UPDATE prospector_instances SET "
                "status = '{{ $json.status }}', "
                "disconnected_at = CASE WHEN '{{ $json.status }}' = 'disconnected' THEN NOW() ELSE disconnected_at END "
                "WHERE instance_token = '{{ $('Route Action').first().json.body.token }}' "
                "RETURNING id"
            ),
            "options": {}
        },
        "id": "inst-update-status",
        "name": "Inst: Update Status",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [800, 1720],
        "credentials": {"postgres": PG_CRED},
        "onError": "continueRegularOutput",
        "alwaysOutputData": True
    },
    {
        "parameters": {
            "jsCode": (
                "const status = $('Inst: Status').first().json;\n"
                "return [{ json: status }];"
            )
        },
        "id": "inst-status-finalize",
        "name": "Inst: Status Finalize",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1040, 1720]
    }
]


def ensure_node(wf, new_node):
    for i, n in enumerate(wf['nodes']):
        if n.get('id') == new_node['id'] or n.get('name') == new_node['name']:
            wf['nodes'][i] = new_node
            return 'updated'
    wf['nodes'].append(new_node)
    return 'added'


def set_conn(conns, src, dst):
    conns[src] = {"main": [[{"node": dst, "type": "main", "index": 0}]]}


def main():
    with open(WF_PATH, 'r', encoding='utf-8') as f:
        wf = json.load(f)

    for node in NEW_NODES:
        res = ensure_node(wf, node)
        print(f"  [{res}] {node['name']}")

    conns = wf['connections']
    set_conn(conns, "Inst: Create", "Inst: Save DB")
    set_conn(conns, "Inst: Save DB", "Inst: Create Finalize")
    set_conn(conns, "Inst: Create Finalize", "Auth Response")

    set_conn(conns, "Inst: Connect", "Inst: Update Connection")
    set_conn(conns, "Inst: Update Connection", "Inst: Connect Finalize")
    set_conn(conns, "Inst: Connect Finalize", "Auth Response")

    set_conn(conns, "Inst: Status", "Inst: Update Status")
    set_conn(conns, "Inst: Update Status", "Inst: Status Finalize")
    set_conn(conns, "Inst: Status Finalize", "Auth Response")
    print("  [ok] conexoes atualizadas")

    with open(WF_PATH, 'w', encoding='utf-8') as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
    print("[ok] workflow.json gravado")


if __name__ == '__main__':
    main()
