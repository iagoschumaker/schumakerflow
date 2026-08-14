/**
 * Briefing Seed — Social Media Mensal
 *
 * Idempotente: usa upsert no template (by tenantId+slug),
 * e recria seções/campos apenas se o template foi criado agora.
 *
 * Uso: npx tsx prisma/seeds/briefing-seed.ts
 * Requer: DATABASE_URL no ambiente.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'month' | 'time' | 'money' | 'number' | 'select' | 'boolean' | 'email' | 'phone' | 'url';
  width?: 'half' | 'full';
  isRequired?: boolean;
  hint?: string;
  placeholder?: string;
  options?: string[];
}

interface SectionDef {
  title: string;
  description?: string;
  kind: 'single' | 'repeater';
  repeaterItemLabel?: string;
  isOptional?: boolean;
  fields: FieldDef[];
}

const TEMPLATE_SLUG = 'social-media-mensal';
const TEMPLATE_NAME = 'Social Media — mensal';

const sections: SectionDef[] = [
  {
    title: 'Identificação',
    kind: 'single',
    fields: [
      { key: 'mes_referencia', label: 'Mês de referência', type: 'month', width: 'half', isRequired: true },
      { key: 'preenchido_por', label: 'Preenchido por', type: 'text', width: 'half' },
    ],
  },
  {
    title: 'Novidades',
    description: 'Produto novo, sabor do mês, item que saiu do cardápio, mudança de embalagem.',
    kind: 'repeater',
    repeaterItemLabel: 'Novidade',
    isOptional: true,
    fields: [
      { key: 'o_que_e', label: 'O que é', type: 'text', width: 'full' },
      { key: 'a_partir_de', label: 'A partir de quando', type: 'date', width: 'half' },
      { key: 'unidades', label: 'Em quais unidades', type: 'text', width: 'half' },
      { key: 'preco', label: 'Preço', type: 'money', width: 'half' },
      { key: 'divulgar_preco', label: 'Podemos divulgar o preço?', type: 'select', width: 'half', options: ['Sim', 'Não'] },
      { key: 'descricao', label: 'Como você descreveria em uma frase', type: 'text', width: 'full' },
    ],
  },
  {
    title: 'Datas e acontecimentos do mês',
    description: 'Eventos, aniversário de loja, feriado que muda o horário, férias, obra, evento no bairro. Inclua até o que parece pequeno.',
    kind: 'repeater',
    repeaterItemLabel: 'Acontecimento',
    fields: [
      { key: 'data', label: 'Data', type: 'date', width: 'half' },
      { key: 'tipo', label: 'Tipo', type: 'select', width: 'half', options: ['Evento', 'Feriado', 'Data da loja', 'Mudança de horário', 'Fechamento', 'Obra', 'Outro'] },
      { key: 'o_que_acontece', label: 'O que acontece', type: 'text', width: 'full' },
      { key: 'unidades', label: 'Em quais unidades', type: 'text', width: 'half' },
      { key: 'divulgar', label: 'Precisa divulgar?', type: 'select', width: 'half', options: ['Sim', 'Não'] },
      { key: 'detalhes', label: 'O que o público precisa saber', type: 'textarea', width: 'full', hint: 'Horário, regra, o que muda para o cliente' },
    ],
  },
  {
    title: 'Promoções do mês',
    description: 'Escreva a oferta e a regra do jeito exato que valem no balcão.',
    kind: 'repeater',
    repeaterItemLabel: 'Promoção',
    isOptional: true,
    fields: [
      { key: 'nome', label: 'Nome da promoção', type: 'text', width: 'half' },
      { key: 'unidades', label: 'Em quais unidades', type: 'text', width: 'half' },
      { key: 'oferta', label: 'A oferta exata, como o cliente vai ler', type: 'text', width: 'full' },
      { key: 'inicio', label: 'Começa em', type: 'date', width: 'half' },
      { key: 'fim', label: 'Termina em', type: 'date', width: 'half' },
      { key: 'dias_horarios', label: 'Dias e horários em que vale', type: 'text', width: 'full' },
      { key: 'regras', label: 'Regras e restrições', type: 'textarea', width: 'full', hint: 'O que não estiver escrito aqui vira discussão no balcão.' },
      { key: 'preco_promocional', label: 'Preço promocional', type: 'money', width: 'half' },
      { key: 'divulgar_preco', label: 'Podemos divulgar o preço?', type: 'select', width: 'half', options: ['Sim', 'Não'] },
    ],
  },
  {
    title: 'Captação do mês',
    kind: 'single',
    fields: [
      { key: 'data_desejada', label: 'Data desejada', type: 'date', width: 'half' },
      { key: 'unidade', label: 'Unidade', type: 'text', width: 'half' },
      { key: 'horario', label: 'Horário de início', type: 'time', width: 'half', hint: 'De preferência no horário mais calmo' },
      { key: 'quem_presente', label: 'Quem estará presente', type: 'text', width: 'half' },
      { key: 'gravar_especifico', label: 'Precisa gravar algo específico neste mês?', type: 'textarea', width: 'full' },
    ],
  },
  {
    title: 'Prioridade do mês',
    kind: 'single',
    fields: [
      { key: 'prioridade', label: 'O que vocês mais querem vender ou divulgar neste mês', type: 'textarea', width: 'full', hint: 'Um ou dois itens. Se for tudo, não é prioridade nenhuma.' },
      { key: 'evitar', label: 'Algo que eu devo evitar neste mês', type: 'textarea', width: 'full', hint: 'Obra, produto em falta, assunto sensível, promoção que acabou' },
    ],
  },
  {
    title: 'Mudou alguma coisa?',
    kind: 'single',
    isOptional: true,
    fields: [
      { key: 'mudancas', label: 'Mudou alguma coisa nas lojas?', type: 'textarea', width: 'full', hint: 'Horário novo, endereço, reforma, fechamento temporário, unidade nova, troca de responsável.' },
    ],
  },
  {
    title: 'Observações',
    kind: 'single',
    isOptional: true,
    fields: [
      { key: 'observacoes', label: 'Mais alguma coisa?', type: 'textarea', width: 'full' },
    ],
  },
];

async function seed() {
  // Get all tenants to seed the template for each one
  const tenants = await prisma.tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true } });

  if (tenants.length === 0) {
    console.log('No active tenants found. Skipping seed.');
    return;
  }

  for (const tenant of tenants) {
    console.log(`Seeding template for tenant: ${tenant.name} (${tenant.id})`);

    // Upsert template (idempotent by tenantId + slug)
    const template = await prisma.briefingTemplate.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: TEMPLATE_SLUG } },
      update: { name: TEMPLATE_NAME, isActive: true },
      create: {
        tenantId: tenant.id,
        name: TEMPLATE_NAME,
        slug: TEMPLATE_SLUG,
        description: 'Coleta mensal de informações para planejamento de conteúdo de redes sociais.',
        isActive: true,
      },
    });

    // Check if template already has sections (don't recreate if so)
    const existingSections = await prisma.briefingTemplateSection.count({
      where: { templateId: template.id },
    });

    if (existingSections > 0) {
      console.log(`  Template already has ${existingSections} sections. Skipping.`);
      continue;
    }

    // Create sections and fields
    for (let si = 0; si < sections.length; si++) {
      const s = sections[si];
      const section = await prisma.briefingTemplateSection.create({
        data: {
          templateId: template.id,
          title: s.title,
          description: s.description || null,
          kind: s.kind,
          repeaterItemLabel: s.repeaterItemLabel || null,
          isOptional: s.isOptional || false,
          sortOrder: si,
        },
      });

      for (let fi = 0; fi < s.fields.length; fi++) {
        const f = s.fields[fi];
        await prisma.briefingTemplateField.create({
          data: {
            sectionId: section.id,
            key: f.key,
            label: f.label,
            hint: f.hint || null,
            placeholder: f.placeholder || null,
            type: f.type,
            options: f.options ? f.options : undefined,
            isRequired: f.isRequired || false,
            width: f.width || 'half',
            sortOrder: fi,
          },
        });
      }

      console.log(`  Section "${s.title}" created with ${s.fields.length} fields.`);
    }

    console.log(`  Template "${TEMPLATE_NAME}" seeded successfully.`);
  }
}

seed()
  .then(() => {
    console.log('Briefing seed completed.');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Briefing seed failed:', e);
    process.exit(1);
  });
