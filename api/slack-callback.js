module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📥 Requisição recebida do Slack');
    
    // Parse payload do Slack
    let payload = req.body.payload 
      ? (typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : req.body.payload)
      : req.body;

    console.log('Tipo de payload:', payload.type);

    // ================================
    // VALIDAÇÃO INICIAL (url_verification)
    // ================================
    if (payload.type === 'url_verification') {
      console.log('✅ Respondendo ao challenge do Slack');
      return res.status(200).json({ challenge: payload.challenge });
    }

    // ================================
    // CALLBACK DO BOTÃO (block_actions)
    // ================================
    if (payload.type === 'block_actions') {
      const userId = payload.user?.id;
      const issueKey = payload.actions?.[0]?.value;

      if (!userId || !issueKey) {
        console.error('❌ Dados faltando:', { userId, issueKey });
        return res.status(400).json({ error: 'Missing data' });
      }

      console.log(`✅ Issue: ${issueKey}, User: ${userId}`);

      // ================================
      // CHAMAR WEBHOOK DO TOQAN
      // ================================
      const toqanWebhookUrl = 'https://api.toqan.ai/webhook/task_000000DHBB1DXOcF0LeymXhLf2bYP';
      const toqanSecret = 'whsec_000000DHBB1DXOcF0LeymXhLf2bYQ';

      console.log('🤖 Chamando webhook Toqan...');

      // Fire and forget (não espera resposta)
      fetch(toqanWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': toqanSecret
        },
        body: JSON.stringify({ 
          issue_key: issueKey, 
          user_id: userId 
        })
      }).then(response => {
        console.log(`✅ Toqan webhook respondeu: HTTP ${response.status}`);
        return response.text();
      }).then(text => {
        console.log(`Resposta Toqan: ${text}`);
      }).catch(error => {
        console.error('❌ Erro ao chamar Toqan:', error.message);
      });

      // ================================
      // RESPONDER AO SLACK (< 3 segundos)
      // ================================
      console.log('✅ Respondendo ao Slack');
      return res.status(200).json({
        replace_original: false,
        text: "✅ Solicitação enviada! Você receberá a sugestão de plano de ação em instantes..."
      });
    }

    // Outros tipos de payload
    console.log('⚠️ Tipo não reconhecido:', payload.type);
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    return res.status(500).json({ 
      error: error.message,
      text: "❌ Erro ao processar solicitação."
    });
  }
};
