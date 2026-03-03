export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📥 Requisição recebida do Slack');
    
    // ================================
    // PARSE PAYLOAD DO SLACK
    // ================================
    let payload;
    
    // Slack envia como form-urlencoded com campo "payload"
    if (req.body.payload) {
      payload = typeof req.body.payload === 'string' 
        ? JSON.parse(req.body.payload) 
        : req.body.payload;
    } else {
      payload = req.body;
    }

    console.log('Payload:', JSON.stringify(payload, null, 2));

    // ================================
    // VALIDAÇÃO INICIAL (url_verification)
    // ================================
    if (payload.type === 'url_verification') {
      console.log('✅ Respondendo ao challenge do Slack');
      return res.status(200).json({ 
        challenge: payload.challenge 
      });
    }

    // ================================
    // CALLBACK DO BOTÃO (block_actions)
    // ================================
    if (payload.type === 'block_actions') {
      const userId = payload.user?.id;
      const issueKey = payload.actions?.[0]?.value;

      if (!userId || !issueKey) {
        console.error('❌ Dados faltando');
        return res.status(400).json({ 
          error: 'Missing data' 
        });
      }

      console.log(`✅ Issue: ${issueKey}, User: ${userId}`);

      // ================================
      // CHAMA TOQAN (API Key)
      // ================================
      const toqanUrl = 'https://api.coco.prod.toqan.ai/api/create_conversation';
      const toqanApiKey = 'sk_630757ceb9f8372870121d45f2cdfc27de4ea02217e53eb4c536bd4908feef6bbe2f907cf41eb6a31f4fc35617dfcdffa5cd5b979d6faee11fa1ed8335b3';

      console.log('🤖 Chamando Toqan...');

      // Fire and forget
      fetch(toqanUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${toqanApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          message: `Solicitar plano de ação para issue ${issueKey}`,
          issue_key: issueKey, 
          user_id: userId 
        })
      }).then(response => {
        console.log(`✅ Toqan: HTTP ${response.status}`);
        return response.text();
      }).then(text => {
        console.log(`Resposta: ${text}`);
      }).catch(error => {
        console.error('❌ Erro Toqan:', error.message);
      });

      // ================================
      // RESPONDE AO SLACK (< 3s)
      // ================================
      return res.status(200).json({
        replace_original: false,
        text: "✅ Solicitação enviada! Você receberá a sugestão de plano de ação em instantes..."
      });
    }

    // Outros tipos
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ 
      error: error.message,
      text: "❌ Erro ao processar solicitação."
    });
  }
}
