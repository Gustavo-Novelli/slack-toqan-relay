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
      const userId = payload.user?.id;
      const issueKey = payload.actions?.[0]?.value;

      if (!userId || !issueKey) {
        console.error('❌ Dados faltando:', { userId, issueKey });
        return res.status(400).json({ error: 'Missing data' });
      }

      console.log(`✅ Issue: ${issueKey}, User: ${userId}`);

      const appsScriptUrl = process.env.APPS_SCRIPT_URL;
      const apiKey = process.env.APPS_SCRIPT_API_KEY;

      if (!appsScriptUrl || !apiKey) {
        console.error('❌ Variáveis de ambiente não configuradas');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      console.log('🤖 Chamando Google Apps Script...');

      try {
        const response = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            api_key: apiKey,
            issueKey: issueKey,
            slackUserId: userId
          })
        });

        const responseText = await response.text();
        console.log(`✅ Apps Script respondeu: HTTP ${response.status}`);
        console.log(`Resposta: ${responseText}`);

      } catch (error) {
        console.error('❌ Erro ao chamar Apps Script:', error.message);
      }

      console.log('✅ Respondendo ao Slack');
      return res.status(200).json({
        replace_original: false,
        text: "✅ Solicitação enviada! Você receberá a sugestão de plano de ação em instantes..."
      });
    }

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

