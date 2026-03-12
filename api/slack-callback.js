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
      const responseUrl = payload.response_url;

      console.log(`Action ID: ${actionId}`);
      console.log(`Issue: ${issueKey}, User: ${userId}`);

      // ============================================
      // BOTÃO: SOLICITAR SUGESTÃO IA
      // ============================================
      if (actionId === 'solicitar_sugestao') {
        
        if (!userId || !issueKey) {
          console.error('❌ Dados faltando:', { userId, issueKey });
          return res.status(400).json({ error: 'Missing data' });
        }

        console.log('🤖 Botão IA clicado!');

        // ✅ 1. RESPONDE WEBHOOK IMEDIATAMENTE
        res.status(200).json({ ok: true });
        console.log('✅ Webhook respondido');

        // ✅ 2. ATUALIZA MENSAGEM ORIGINAL (REMOVE BOTÃO IA)
        if (responseUrl) {
          try {
            const originalBlocks = payload.message?.blocks || [];
            
            // Remove apenas o botão de IA, mantém os outros
            const blocksAtualizados = originalBlocks.map(block => {
              if (block.type === 'actions') {
                return {
                  type: "actions",
                  elements: block.elements.filter(el => el.action_id !== 'solicitar_sugestao')
                };
              }
              return block;
            });

            await fetch(responseUrl, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                replace_original: true,
                blocks: blocksAtualizados
              })
            });
            
            console.log('✅ Botão de IA removido da mensagem original');
          } catch (err) {
            console.error('❌ Erro ao atualizar mensagem:', err.message);
          }
        }

        // ✅ 3. ENVIA MENSAGEM NOVA DE LOADING
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
                text: `⏳ *Processando sugestão de plano de ação para ${issueKey}...*\n\nA IA está analisando o contexto da issue. Você receberá a resposta em instantes!`
              })
            });
            console.log('✅ Mensagem de loading enviada');
          } catch (err) {
            console.error('❌ Erro ao enviar mensagem de loading:', err.message);
          }
        } else {
          console.error('⚠️ SLACK_BOT_TOKEN não configurado');
        }

        // ✅ 4. CHAMA TOQAN (IA)
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

        console.log('🤖 Chamando Toqan webhook...');
        console.log('📤 Payload:', JSON.stringify(toqanPayload));

        try {
          const response = await fetch(toqanWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': toqanSecret
            },
            body: JSON.stringify(toqanPayload)
          });

          const responseText = await response.text();
          
          console.log(`✅ Toqan respondeu: HTTP ${response.status}`);
          console.log(`Resposta: ${responseText}`);

          if (!response.ok) {
            console.error(`❌ Toqan erro ${response.status}: ${responseText}`);
          }

        } catch (fetchError) {
          console.error('❌ Erro ao chamar Toqan:', fetchError.message);
          console.error('Stack:', fetchError.stack);
        }

        return;
      }

      // Outros action_ids podem vir aqui no futuro
      console.log('⚠️ action_id não reconhecido:', actionId);
      return res.status(200).json({ ok: true });
    }

    console.log('⚠️ Tipo de payload não reconhecido:', payload.type);
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
