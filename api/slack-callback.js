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
      console.log(`Issue: ${issueKey}, User: ${userId}`);

      // ============================================
      // BOTÃO: SOLICITAR IA
      // ============================================
      if (actionId === 'solicitar_sugestao') {
        
        if (!userId || !issueKey) {
          console.error('❌ Dados faltando');
          return res.status(400).json({ error: 'Missing data' });
        }

        // ✅ 1. RESPONDE O WEBHOOK SLACK (RÁPIDO)
        res.status(200).json({ ok: true });
        console.log('✅ Webhook respondido');

        // ✅ 2. ENVIA MENSAGEM NOVA (COM BOT TOKEN)
        const slackBotToken = process.env.SLACK_BOT_TOKEN;
        
        if (slackBotToken) {
          try {
            await fetch('https://slack.com/api/chat.postMessage', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${slackBotToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                channel: userId,
                text: `⏳ Processando sugestão de plano de ação para ${issueKey}...\n\nA IA está analisando o contexto. Você receberá a resposta em instantes!`
              })
            });
            console.log('✅ Mensagem de loading enviada');
          } catch (err) {
            console.error('❌ Erro ao enviar mensagem:', err);
          }
        }

        // ✅ 3. CHAMA TOQAN
        const toqanWebhookUrl = process.env.TOQAN_WEBHOOK_URL;
        const toqanSecret = process.env.TOQAN_WEBHOOK_SECRET;

        if (!toqanWebhookUrl || !toqanSecret) {
          console.error('❌ Variáveis Toqan não configuradas');
          return;
        }

        const toqanPayload = {
          message: `Solicitação de plano de ação para a issue ${issueKey}`,
          issue_key: issueKey,
          user_id: userId
        };

        console.log('🤖 Chamando Toqan...');

        try {
          const response = await fetch(toqanWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': toqanSecret
            },
            body: JSON.stringify(toqanPayload)
          });

          console.log(`✅ Toqan respondeu: HTTP ${response.status}`);

        } catch (fetchError) {
          console.error('❌ Erro Toqan:', fetchError.message);
        }

        return;
      }

      // Outros action_ids...
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
