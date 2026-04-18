CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS prospector_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_empresa VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    produtos_servicos TEXT,
    icp TEXT,
    diferenciais TEXT,
    tom_abordagem VARCHAR(20) DEFAULT 'consultivo',
    proposta_valor TEXT,
    mensagem_padrao TEXT,
    openai_api_key VARCHAR(255),
    serpapi_key VARCHAR(255),
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS prospector_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES prospector_tenants(id) ON DELETE CASCADE,
    label VARCHAR(100),
    uazapi_url VARCHAR(255),
    instance_token VARCHAR(255),
    instance_name VARCHAR(255),
    uazapi_session_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'disconnected',
    disconnected_at TIMESTAMP,
    last_qr_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE prospector_instances ADD COLUMN IF NOT EXISTS instance_name VARCHAR(255);
ALTER TABLE prospector_instances ADD COLUMN IF NOT EXISTS uazapi_session_id VARCHAR(255);
ALTER TABLE prospector_instances ADD COLUMN IF NOT EXISTS last_qr_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS prospector_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES prospector_tenants(id) ON DELETE CASCADE,
    empresa VARCHAR(255),
    telefone VARCHAR(20),
    rating DECIMAL(3,1),
    reviews INTEGER,
    especialidades TEXT,
    site VARCHAR(500),
    has_whatsapp VARCHAR(20),
    disparo VARCHAR(10) DEFAULT 'nao',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_tenant ON prospector_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pl_tenant ON prospector_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pl_telefone ON prospector_leads(tenant_id, telefone);
CREATE INDEX IF NOT EXISTS idx_pt_email ON prospector_tenants(email);
CREATE INDEX IF NOT EXISTS idx_pl_disparo ON prospector_leads(tenant_id, disparo);
CREATE INDEX IF NOT EXISTS idx_pl_created ON prospector_leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pi_status ON prospector_instances(tenant_id, status);
