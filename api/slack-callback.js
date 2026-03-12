module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📥 Requisição recebida do Slack');
    
    let payload = req.body.payload 
      ? (typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : req.body.payload)
      : req.body;

    console.log('Tipo de payload:', payload.type);

    if (payload.type === 'url_verification') {
      console.log('✅ Respondendo ao challenge do Slack');
      return res.status(200).json({ challenge: payload.challenge });
    }

    if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      const actionId = action.action_id;
      const userId = payload.user?.id;
      const issueKey = action.value;

      console.log(`Action ID: ${actionId}`);
      console.log(`✅ Issue: ${issueKey}, User: ${userId}`);

      // ============================================
      // BOTÃO: SOLICITAR IA
      // ============================================
      if (actionId === 'solicitar_sugestao') {
        
        if (!userId || !issueKey) {
          console.error('❌ Dados faltando:', { userId, issueKey });
          return res.status(400).json({ error: 'Missing data' });
        }

        console.log('🤖 BOTÃO IA CLICADO!');

        // ============================================
        // 1️⃣ RESPONDE SLACK IMEDIATAMENTE (< 3 seg)
        // ============================================
        res.status(200).json({
          replace_original: true,
          text: "⏳ Processando IA... Por favor, aguarde. Você receberá a resposta em instantes."
        });

        console.log('✅ Slack respondido - botão atualizado');

        // ============================================
        // 2️⃣ CHAMA TOQAN EM BACKGROUND (não bloqueia)
        // ============================================
        const toqanWebhookUrl = process.env.TOQAN_WEBHOOK_URL;
        const toqanSecret = process.env.TOQAN_WEBHOOK_SECRET;

        if (!toqanWebhookUrl || !toqanSecret) {
          console.error('❌ Variáveis de ambiente não configuradas');
          return; // Já respondeu ao Slack, só retorna
        }

        const toqanPayload = {
          message: `Solicitação de plano de ação para a issue ${issueKey}`,
          issue_key: issueKey,
          user_id: userId
        };

        console.log('📤 Payload enviado ao Toqan:', JSON.stringify(toqanPayload));
        console.log('🤖 Chamando Toqan webhook em background...');

        // Fire and forget - não espera resposta
        fetch(toqanWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': toqanSecret
          },
          body: JSON.stringify(toqanPayload)
        })
        .then(response => {
          console.log(`✅ Toqan respondeu: HTTP ${response.status}`);
          return response.text();
        })
        .then(text => {
          console.log(`Resposta: ${text}`);
        })
        .catch(error => {
          console.error('❌ Erro ao chamar Toqan:', error.message);
        });

        // Não precisa return aqui, já respondeu acima
        return;
      }

      // Outros action_ids podem vir aqui no futuro
      console.log('⚠️ action_id não reconhecido:', actionId);
      return res.status(200).json({ ok: true });
    }

    console.log('⚠️ Tipo não reconhecido:', payload.type);
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({ 
      error: error.message,
      text: "❌ Erro ao processar solicitação."
    });
  }
};
