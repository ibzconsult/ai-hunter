"""
Adiciona rotas list_instances e delete_instance ao workflow.

- Route Action ganha 2 outputs novos: ListInstances, DeleteInstance
- Novos nodes: Inst: List DB, Inst: List Respond, Inst: Delete DB, Inst: Delete Respond
- Conecta tudo ao Auth Response

Idempotente.
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
                "SELECT id, label, uazapi_url, instance_token, instance_name, status, "
                "uazapi_session_id, last_qr_at, disconnected_at, created_at "
                "FROM prospector_instances "
                "WHERE tenant_id = '{{ $json.body.tenant_id }}' "
                "ORDER BY created_at DESC"
            ),
            "options": {}
        },
        "id": "inst-list-db",
        "name": "Inst: List DB",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [560, 1880],
        "credentials": {"postgres": PG_CRED},
        "alwaysOutputData": True
    },
    {
        "parameters": {
            "jsCode": (
                "const rows = $input.all().map(function(i){ return i.json; });\n"
                "return [{ json: { success: true, instances: rows } }];"
            )
        },
        "id": "inst-list-respond",
        "name": "Inst: List Respond",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [800, 1880]
    },
    {
        "parameters": {
            "operation": "executeQuery",
            "query": (
                "DELETE FROM prospector_instances "
                "WHERE id = '{{ $json.body.instance_id }}' "
                "AND tenant_id = '{{ $json.body.tenant_id }}' "
                "RETURNING id"
            ),
            "options": {}
        },
        "id": "inst-delete-db",
        "name": "Inst: Delete DB",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [560, 2040],
        "credentials": {"postgres": PG_CRED},
        "onError": "continueRegularOutput",
        "alwaysOutputData": True
    },
    {
        "parameters": {
            "jsCode": (
                "const r = $input.first().json;\n"
                "if (r && r.id) return [{ json: { success: true, deleted_id: r.id } }];\n"
                "return [{ json: { success: false, error: 'Instancia nao encontrada' } }];"
            )
        },
        "id": "inst-delete-respond",
        "name": "Inst: Delete Respond",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [800, 2040]
    }
]


LIST_RULE = {
    "conditions": {
        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
        "conditions": [{
            "id": "inst-list",
            "leftValue": "={{ $json.body.action }}",
            "rightValue": "list_instances",
            "operator": {"type": "string", "operation": "equals"}
        }],
        "combinator": "and"
    },
    "renameOutput": True,
    "outputKey": "ListInstances"
}

DELETE_RULE = {
    "conditions": {
        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
        "conditions": [{
            "id": "inst-delete",
            "leftValue": "={{ $json.body.action }}",
            "rightValue": "delete_instance",
            "operator": {"type": "string", "operation": "equals"}
        }],
        "combinator": "and"
    },
    "renameOutput": True,
    "outputKey": "DeleteInstance"
}


def ensure_node(wf, new_node):
    for i, n in enumerate(wf['nodes']):
        if n.get('id') == new_node['id'] or n.get('name') == new_node['name']:
            wf['nodes'][i] = new_node
            return 'updated'
    wf['nodes'].append(new_node)
    return 'added'


def ensure_rule(rules, new_rule):
    key = new_rule['outputKey']
    for i, r in enumerate(rules):
        if r.get('outputKey') == key:
            rules[i] = new_rule
            return 'updated'
    rules.append(new_rule)
    return 'added'


def set_conn(conns, src, dst_list):
    conns[src] = {"main": [[{"node": d, "type": "main", "index": 0}] for d in (dst_list if isinstance(dst_list[0], list) else [dst_list])]}


def set_simple_conn(conns, src, dst):
    conns[src] = {"main": [[{"node": dst, "type": "main", "index": 0}]]}


def main():
    with open(WF_PATH, 'r', encoding='utf-8') as f:
        wf = json.load(f)

    for node in NEW_NODES:
        res = ensure_node(wf, node)
        print(f"  [{res}] node {node['name']}")

    for n in wf['nodes']:
        if n.get('name') == 'Route Action':
            rules = n['parameters']['rules']['values']
            r1 = ensure_rule(rules, LIST_RULE)
            r2 = ensure_rule(rules, DELETE_RULE)
            print(f"  [{r1}] route ListInstances")
            print(f"  [{r2}] route DeleteInstance")
            break

    conns = wf['connections']

    ra = conns['Route Action']['main']
    target_names = [lst[0]['node'] if lst else None for lst in ra]
    if 'Inst: List DB' not in target_names:
        ra.append([{"node": "Inst: List DB", "type": "main", "index": 0}])
        print("  [added] Route Action -> Inst: List DB")
    if 'Inst: Delete DB' not in target_names:
        ra.append([{"node": "Inst: Delete DB", "type": "main", "index": 0}])
        print("  [added] Route Action -> Inst: Delete DB")

    set_simple_conn(conns, "Inst: List DB", "Inst: List Respond")
    set_simple_conn(conns, "Inst: List Respond", "Auth Response")
    set_simple_conn(conns, "Inst: Delete DB", "Inst: Delete Respond")
    set_simple_conn(conns, "Inst: Delete Respond", "Auth Response")

    print("  [ok] conexoes gravadas")

    with open(WF_PATH, 'w', encoding='utf-8') as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
    print("[ok] workflow.json gravado")


if __name__ == '__main__':
    main()
