export type FewShot = {
  firstName: string | null;
  empresa: string;
  segmento: string;
  contexto: string;
  messages: string[];
};

export const FEW_SHOTS: Record<string, FewShot[]> = {
  odonto: [
    {
      firstName: 'Rafael',
      empresa: 'Santa Fé Odonto',
      segmento: 'odonto',
      contexto: 'quer aumentar demanda de implantes',
      messages: [
        'Rafael, tudo bem?',
        'Aqui é a Lia da ibusiness',
        'Vi que a Santa Fé é referência em implante aí em Fortaleza',
        'A maioria das clínicas boas perde caixa no intervalo entre avaliação e fechamento — paciente esfria em 3 dias',
        'Posso te mandar um caso parecido que a gente rodou?',
      ],
    },
    {
      firstName: null,
      empresa: 'OdontoCenter',
      segmento: 'odonto',
      contexto: 'clínica multi-profissional',
      messages: [
        'Oi, tudo bem por aí?',
        'Aqui é o Marcos da ibusiness',
        'Olhei rápido a OdontoCenter — equipe enxuta e variada de especialidades',
        'O gargalo mais comum nesse perfil é remarcação: quando o paciente desmarca o ortodontista some o slot',
        'Como vocês lidam com remarcação hoje?',
      ],
    },
  ],
  juridico: [
    {
      firstName: 'Camila',
      empresa: 'Lima & Costa Advogados',
      segmento: 'juridico',
      contexto: 'tributário PME',
      messages: [
        'Camila, posso te roubar 30s?',
        'Aqui é o João da ibusiness',
        'Vi que Lima & Costa tem foco forte em tributário pra PME',
        'Boa parte da entrada via site some pelo tempo de retorno — lead de tributário decide rápido se não responder em 1h',
        'Posso te mandar um print do que quero dizer?',
      ],
    },
  ],
  tech: [
    {
      firstName: 'Bruno',
      empresa: 'CloudFlow',
      segmento: 'tech',
      contexto: 'SaaS de fluxo de aprovação',
      messages: [
        'Bruno, tudo bem?',
        'Aqui é a Ana da ibusiness',
        'Olhei a CloudFlow — proposta clara, mas a página de pricing não tem trial direto',
        'Em SaaS desse perfil a fricção do "fale com vendas" custa caro: o lead técnico evapora no primeiro form longo',
        'Topa receber 3 pontos onde a gente geraria conversão primeiro?',
      ],
    },
  ],
  varejo: [
    {
      firstName: null,
      empresa: 'Auto Peças Cidade Verde',
      segmento: 'varejo',
      contexto: 'distribuidora autopeças',
      messages: [
        'Oi, tudo bem por aí?',
        'Aqui é o Marcos da ibusiness',
        'Olhando distribuidoras de autopeças no Ceará, vocês apareceram',
        'Balconista bom vende presencial, mas perde o WhatsApp no pico',
        'Como vocês tão lidando com o WhatsApp no horário de movimento hoje?',
      ],
    },
  ],
  saude: [
    {
      firstName: 'Dra. Paula',
      empresa: 'Clínica Vitta',
      segmento: 'saude',
      contexto: 'clínica multidisciplinar',
      messages: [
        'Paula, tudo bem?',
        'Aqui é o Henrique da ibusiness',
        'Vi que a Vitta junta nutri, psico e fisio sob o mesmo teto',
        'Em clínicas multi a maior dor é o paciente que vem pra um e nunca conhece os outros — cross-sell zero',
        'Quer que eu te mande os 3 ajustes onde isso muda?',
      ],
    },
  ],
  educacao: [
    {
      firstName: 'Felipe',
      empresa: 'Instituto Norte',
      segmento: 'educacao',
      contexto: 'curso preparatório',
      messages: [
        'Felipe, posso te roubar 30s?',
        'Aqui é a Lia da ibusiness',
        'Vi que o Norte tem turmas pra OAB e concurso',
        'Captação de aluno em preparatório vive de prova social rápida — quem demora 2 dias pra responder perde o lead pra concorrente que respondeu em 10min',
        'Posso te mandar um caso de uma escola parecida?',
      ],
    },
  ],
  b2b_servicos: [
    {
      firstName: 'Roberto',
      empresa: 'Mind Consultoria',
      segmento: 'b2b_servicos',
      contexto: 'consultoria estratégica',
      messages: [
        'Roberto, tudo bem?',
        'Aqui é o Diego da ibusiness',
        'Vi a Mind — bem posicionada em estratégia pra média indústria',
        'O gargalo de quem vende ticket alto B2B costuma ser o tempo entre primeiro contato e diagnóstico — perde-se 30% só nesse intervalo',
        'Como tá o ciclo médio de vocês hoje?',
      ],
    },
  ],
  ecommerce: [
    {
      firstName: null,
      empresa: 'Loja Verde',
      segmento: 'ecommerce',
      contexto: 'e-commerce moda sustentável',
      messages: [
        'Oi, bom te encontrar por aqui',
        'Aqui é a Júlia da ibusiness',
        'Vi a Loja Verde — proposta forte de moda sustentável',
        'Em e-commerce desse nicho o problema raramente é tráfego e quase sempre é abandono no checkout',
        'Posso te mandar 2 ajustes que sobem conversão sem mexer em ads?',
      ],
    },
  ],
  imobiliario: [
    {
      firstName: 'Lucas',
      empresa: 'Vivenda Imóveis',
      segmento: 'imobiliario',
      contexto: 'imobiliária médio porte',
      messages: [
        'Lucas, tudo bem?',
        'Aqui é o Rafa da ibusiness',
        'Vi a Vivenda — bom mix de venda e locação',
        'Em imobiliária o lead que pergunta no anúncio e não recebe resposta em 5min praticamente desaparece',
        'Como vocês fazem o primeiro retorno hoje?',
      ],
    },
  ],
  financeiro: [
    {
      firstName: 'Daniel',
      empresa: 'Holding Prata',
      segmento: 'financeiro',
      contexto: 'consultoria financeira',
      messages: [
        'Daniel, posso te roubar 30s?',
        'Aqui é o Caio da ibusiness',
        'Vi a Prata — atendimento patrimonial e wealth',
        'Em consultoria financeira a parte mais cara é o tempo do sócio em call de qualificação que poderia ser pré-filtrada',
        'Topa receber um fluxo de qualificação que rodamos pra outra holding?',
      ],
    },
  ],
  industria: [
    {
      firstName: null,
      empresa: 'Metalúrgica Asa',
      segmento: 'industria',
      contexto: 'indústria metalúrgica',
      messages: [
        'Oi, tudo bem por aí?',
        'Aqui é o Tiago da ibusiness',
        'Vi a Asa — produção sob demanda pra setor automotivo',
        'Em indústria de pedido sob medida o orçamento manual atrasa o ciclo: cliente chega com pressa, RFQ leva 4 dias',
        'Como tá o tempo médio de cotação aí hoje?',
      ],
    },
  ],
  construcao: [
    {
      firstName: 'Felipe',
      empresa: 'Construtora Boa Vista',
      segmento: 'construcao',
      contexto: 'construtora regional',
      messages: [
        'Felipe, tudo bem?',
        'Aqui é o Bruno da ibusiness',
        'Vi a Boa Vista — empreendimentos residenciais aí na região',
        'Plantão de vendas no fim de semana costuma capturar interesse, mas segunda o lead esfriou — corretor demora pra ligar',
        'Posso te mandar como outras construtoras matam essa fricção?',
      ],
    },
  ],
  alimentacao: [
    {
      firstName: 'Camila',
      empresa: 'Pizzaria do Vito',
      segmento: 'alimentacao',
      contexto: 'pizzaria delivery',
      messages: [
        'Camila, tudo bem?',
        'Aqui é o Léo da ibusiness',
        'Vi a Vito — delivery próprio aí no bairro',
        'A maior dor de pizzaria que sai do iFood é o cliente esquecer o WhatsApp da casa — sem recompra, sem fidelização',
        'Quer ver como a gente reativa cliente parado em 1 mensagem?',
      ],
    },
  ],
  beleza: [
    {
      firstName: 'Marcela',
      empresa: 'Studio Beauty',
      segmento: 'beleza',
      contexto: 'salão de beleza',
      messages: [
        'Marcela, tudo bem?',
        'Aqui é a Bia da ibusiness',
        'Vi o Studio Beauty — bem posicionado em colorimetria',
        'Em salão a maior dor é o no-show: cliente marca e some — agenda fica com buraco que ninguém preenche',
        'Posso te mandar como outras unidades cortaram no-show pela metade?',
      ],
    },
  ],
  automotivo: [
    {
      firstName: 'Eduardo',
      empresa: 'AutoCenter',
      segmento: 'automotivo',
      contexto: 'oficina mecânica',
      messages: [
        'Eduardo, tudo bem?',
        'Aqui é o Vitor da ibusiness',
        'Vi a AutoCenter — mecânica geral aí na região',
        'Cliente que faz revisão 1 vez raramente volta na seguinte porque ninguém lembra ele — 70% vai pra concessionária',
        'Quer que eu te mande como reativar essa base parada?',
      ],
    },
  ],
  generico: [
    {
      firstName: 'Rafael',
      empresa: 'Santa Fé Odonto',
      segmento: 'generico',
      contexto: 'quer aumentar demanda',
      messages: [
        'Rafael, tudo bem?',
        'Aqui é a Lia da ibusiness',
        'Vi rapidamente o site da Santa Fé',
        'A maioria das empresas desse porte perde lead no intervalo entre primeiro contato e retorno — esfria em 3 dias',
        'Posso te mandar um caso parecido que a gente rodou?',
      ],
    },
    {
      firstName: null,
      empresa: 'Auto Peças Cidade Verde',
      segmento: 'generico',
      contexto: 'distribuidora',
      messages: [
        'Oi, tudo bem por aí?',
        'Aqui é o Marcos da ibusiness',
        'Olhando empresas do segmento, vocês apareceram',
        'Vendedor bom converte presencial, mas perde o WhatsApp no pico',
        'Como vocês tão lidando com o WhatsApp no horário de movimento hoje?',
      ],
    },
    {
      firstName: 'Lia',
      empresa: 'Studio Lia Pilates',
      segmento: 'generico',
      contexto: 'sem site ativo',
      messages: [
        'Lia, posso te roubar 30s?',
        'Vi que o Studio Lia não tem site ativo — em pilates, 70% da primeira busca do aluno é no Google',
        'A gente sobe site + landing de aula experimental em 5 dias. Posso te mandar uma prévia?',
      ],
    },
  ],
};

export type Segmento = keyof typeof FEW_SHOTS;

export function classifySegment(raw?: string | null): Segmento {
  const s = (raw || '').toLowerCase();
  if (!s) return 'generico';
  if (FEW_SHOTS[s as Segmento]) return s as Segmento;
  if (/odont|dentista|implant|ortodont/.test(s)) return 'odonto';
  if (/advog|jurid|escrit.{0,10}advoc|tributari/.test(s)) return 'juridico';
  if (/software|saas|tecnolog|tech|\bti\b|dev|startup|aplicativ/.test(s)) return 'tech';
  if (/varejo|loja|comerc|atacad|distribuid/.test(s)) return 'varejo';
  if (/sa[uú]de|cl[íi]nica|m[ée]dic|hospital|laborator|fisio|psico|nutri/.test(s)) return 'saude';
  if (/educa|escola|curso|treinament|preparat[óo]rio|faculdade/.test(s)) return 'educacao';
  if (/consultor|servi[çc]o.*empres|b2b|ag[êe]ncia/.test(s)) return 'b2b_servicos';
  if (/e-?commerce|loja virtual|marketplace|shop/.test(s)) return 'ecommerce';
  if (/imobili|im[óo]ve|corretor|incorporadora/.test(s)) return 'imobiliario';
  if (/financ|investi|wealth|holding|seguros|cont[áa]bil|assessor.*financ/.test(s)) return 'financeiro';
  if (/ind[úu]stri|metal[úu]rg|f[áa]brica|manufat/.test(s)) return 'industria';
  if (/constru[çc]|empreitei|imobili[áa]ria.*construt|construtora/.test(s)) return 'construcao';
  if (/restaurant|pizzar|aliment|food|delivery|hamburg|bar |padaria/.test(s)) return 'alimentacao';
  if (/beleza|sal[ãa]o|barbearia|este[tt]ica|spa|cabelei/.test(s)) return 'beleza';
  if (/oficina|mec[âa]nica|auto.*centr|funilaria|automotivo|concession/.test(s)) return 'automotivo';
  return 'generico';
}

export function pickFewShots(segmento?: string | null, n = 2): FewShot[] {
  const key = classifySegment(segmento);
  const pool = FEW_SHOTS[key] ?? FEW_SHOTS.generico;
  return pool.slice(0, n);
}

export function renderFewShots(shots: FewShot[]): string {
  return shots
    .map((s, i) => {
      const header = `### Ex ${i + 1} — segmento=${s.segmento}, firstName=${s.firstName ?? 'null'}, empresa=${s.empresa}, contexto=${s.contexto}`;
      const arr = JSON.stringify(s.messages);
      return `${header}\n${arr}`;
    })
    .join('\n\n');
}
