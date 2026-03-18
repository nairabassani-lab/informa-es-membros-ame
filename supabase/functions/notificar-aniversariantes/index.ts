import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async () => {
  // Data atual no fuso horário de Brasília (UTC-3)
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const diaHoje = agora.getDate();
  const mesHoje = agora.getMonth() + 1;

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Busca aniversariantes do dia
  const { data: aniversariantes, error: errAniv } = await db
    .from('aniversariantes')
    .select('nome, ano')
    .eq('dia', diaHoje)
    .eq('mes', mesHoje)
    .order('nome');

  if (errAniv) {
    return new Response(JSON.stringify({ error: errAniv.message }), { status: 500 });
  }

  if (!aniversariantes || aniversariantes.length === 0) {
    return new Response(JSON.stringify({ mensagem: 'Nenhum aniversariante hoje.' }), { status: 200 });
  }

  const anoAtual = agora.getFullYear();
  const lista = aniversariantes.map(a => {
    if (a.ano) {
      const idade = anoAtual - a.ano;
      return `• ${a.nome} (${idade} anos)`;
    }
    return `• ${a.nome}`;
  }).join('\n');

  const dia = String(diaHoje).padStart(2, '0');
  const mes = String(mesHoje).padStart(2, '0');

  const mensagem = `🎂 *Aniversariantes de hoje (${dia}/${mes}):*\n\n${lista}\n\n_Não esqueça de dar os parabéns!_ 🎉`;

  // Busca destinatários ativos
  const { data: destinatarios, error: errDest } = await db
    .from('destinatarios')
    .select('nome, telegram_chat_id')
    .eq('ativo', true);

  if (errDest) {
    return new Response(JSON.stringify({ error: errDest.message }), { status: 500 });
  }

  if (!destinatarios || destinatarios.length === 0) {
    return new Response(JSON.stringify({ mensagem: 'Nenhum destinatário ativo cadastrado.' }), { status: 200 });
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const resultados = [];

  for (const dest of destinatarios) {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: dest.telegram_chat_id,
        text: mensagem,
        parse_mode: 'Markdown',
      }),
    });
    const resultado = await resposta.json();
    resultados.push({ destinatario: dest.nome, ok: resultado.ok });
  }

  return new Response(JSON.stringify({ enviados: resultados }), { status: 200 });
});
