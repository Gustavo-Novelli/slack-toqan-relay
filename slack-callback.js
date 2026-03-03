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
    console.log('📥 Requisição recebida');
    
    let payload = req.body.payload 
      ? (typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : req.body.payload)
      : req.body;

    console.log('Payload:', JSON.stringify(payload, null, 2));

    // url_verification
    if (payload.type === 'url_verification') {
      console.log('✅ Challenge');
      return res.status(200).json({ challenge: payload.challenge });
    }

    // block_actions
    if (payload.type === 'block_actions') {
      const userId = payload.user?.id;
      const issueKey = payload.actions?.[0]?.value;

      console.log(`Issue: ${issueKey}, User: ${userId}`);

      // Chamar Toqan
      const response = await fetch('https://api.coco.prod.toqan.ai/api/create_conversation', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer sk_630757ceb9f8372870121d45f2cdfc27de4ea02217e53eb4c536bd4908feef6bbe2f907cf41eb6a31f4fc35617dfcdffa5cd5b979d6faee11fa1ed8335b3',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          message: `Plano de ação para ${issueKey}`,
          issue_key: issueKey, 
          user_id: userId 
        })
      });

      console.log(`Toqan: ${response.status}`);

      return res.status(200).json({
        replace_original: false,
        text: "✅ Solicitação enviada! Você receberá a sugestão em instantes..."
      });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ error: error.message });
  }
};
