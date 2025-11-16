import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

// Store chatbot configs in memory
const chatbotConfigs = new Map();

// Load saved configs
async function loadConfigs() {
  // First try to load from environment variable (Vercel)
  if (process.env.CHATBOT_CONFIGS) {
    try {
      const configs = JSON.parse(process.env.CHATBOT_CONFIGS);
      configs.forEach(config => chatbotConfigs.set(config.id, config));
      console.log(`✅ Loaded ${chatbotConfigs.size} chatbot(s) from environment`);
      return;
    } catch (error) {
      console.error('❌ Error loading from environment:', error);
    }
  }
  
  // Fall back to file system (local development)
  if (process.env.VERCEL) {
    console.log('⚠️  Running on Vercel - using in-memory storage only');
    return;
  }
  
  try {
    const data = await fs.readFile('./chatbot-configs.json', 'utf-8');
    const configs = JSON.parse(data);
    configs.forEach(config => chatbotConfigs.set(config.id, config));
    console.log(`✅ Loaded ${chatbotConfigs.size} chatbot(s)`);
  } catch {
    console.log('⚠️  No saved configs - starting fresh');
  }
}

// Save configs to file (skip on Vercel)
async function saveConfigs() {
  if (process.env.VERCEL) {
    console.log('⚠️  Skipping file save on Vercel (using in-memory storage)');
    return;
  }
  const configs = Array.from(chatbotConfigs.values());
  await fs.writeFile('./chatbot-configs.json', JSON.stringify(configs, null, 2));
  console.log('💾 Saved chatbot configurations');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    chatbots: chatbotConfigs.size,
    timestamp: new Date().toISOString()
  });
});

// Create new chatbot (admin endpoint)
app.post('/api/admin/create-chatbot', async (req, res) => {
  try {
    const { clientName, businessName, businessInfo, knowledgeBase, customization } = req.body;
    
    const chatbotId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const config = {
      id: chatbotId,
      clientName,
      businessName,
      businessInfo,
      knowledgeBase,
      customization: customization || {
        primaryColor: '#0066FF',
        welcomeMessage: `Hi! I'm ${businessName}'s AI assistant. How can I help you today?`
      },
      createdAt: new Date().toISOString(),
      active: true
    };
    
    chatbotConfigs.set(chatbotId, config);
    await saveConfigs();
    
    const embedCode = `<!-- Automagixx Chatbot -->
<script>
(function(){
  var d=document,s=d.createElement('div');
  s.id='automagixx-chat';
  s.innerHTML='<style>#automagixx-btn{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:#0066FF;color:white;border:none;font-size:28px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999}#automagixx-win{display:none;position:fixed;bottom:100px;right:20px;width:380px;height:600px;background:white;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:9999;flex-direction:column}#automagixx-win iframe{width:100%;height:100%;border:0;border-radius:16px}</style><button id="automagixx-btn" onclick="toggleChat()">💬</button><div id="automagixx-win"><iframe src="http://YOUR-VM-IP:3001/widget/${chatbotId}"></iframe></div>';
  d.body.appendChild(s);
  window.toggleChat=function(){
    var w=d.getElementById('automagixx-win'),b=d.getElementById('automagixx-btn');
    if(w.style.display==='none'||!w.style.display){w.style.display='flex';b.style.display='none'}else{w.style.display='none';b.style.display='block'}
  };
})();
</script>`;
    
    res.json({
      success: true,
      chatbotId,
      embedCode,
      previewUrl: `http://YOUR-VM-IP:3001/widget/${chatbotId}`
    });
    
  } catch (error) {
    console.error('Error creating chatbot:', error);
    res.status(500).json({ error: 'Failed to create chatbot' });
  }
});

// Chat widget page
app.get('/widget/:chatbotId', (req, res) => {
  const config = chatbotConfigs.get(req.params.chatbotId);
  if (!config) return res.status(404).send('Chatbot not found');
  
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; height: 100vh; display: flex; flex-direction: column; }
    #header { background: #0066FF; color: white; padding: 16px; }
    #header h3 { font-size: 16px; font-weight: 600; }
    #header p { font-size: 12px; opacity: 0.9; margin-top: 4px; }
    #messages { flex: 1; overflow-y: auto; padding: 16px; background: #f8f9fa; display: flex; flex-direction: column; gap: 12px; }
    .msg { max-width: 80%; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; }
    .user { background: #0066FF; color: white; align-self: flex-end; }
    .bot { background: white; color: #1f2937; align-self: flex-start; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    #input-area { padding: 16px; border-top: 1px solid #e5e7eb; background: white; }
    #input-form { display: flex; gap: 8px; }
    #msg-input { flex: 1; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    #send-btn { background: #0066FF; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 500; }
    #send-btn:hover { background: #0052cc; }
    #send-btn:disabled { background: #ccc; cursor: not-allowed; }
  </style>
</head>
<body>
  <div id="header">
    <h3>${config.businessName}</h3>
    <p>AI Assistant • Online</p>
  </div>
  <div id="messages"></div>
  <div id="input-area">
    <form id="input-form">
      <input id="msg-input" placeholder="Type your message..." autocomplete="off" />
      <button id="send-btn" type="submit">Send</button>
    </form>
  </div>
  <script>
    const chatId = '${req.params.chatbotId}';
    const messages = document.getElementById('messages');
    const form = document.getElementById('input-form');
    const input = document.getElementById('msg-input');
    const sendBtn = document.getElementById('send-btn');
    
    // Show welcome message
    addMsg('${config.customization.welcomeMessage.replace(/'/g, "\\'")}', 'bot');
    
    form.onsubmit = async (e) => {
      e.preventDefault();
      const msg = input.value.trim();
      if (!msg) return;
      
      input.value = '';
      sendBtn.disabled = true;
      addMsg(msg, 'user');
      
      try {
        const res = await fetch('/api/chat/' + chatId + '/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        addMsg(data.response, 'bot');
      } catch (error) {
        addMsg('Sorry, I encountered an error. Please try again.', 'bot');
      }
      
      sendBtn.disabled = false;
      input.focus();
    };
    
    function addMsg(text, sender) {
      const div = document.createElement('div');
      div.className = 'msg ' + sender;
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }
  </script>
</body>
</html>`);
});

// Handle chat messages
app.post('/api/chat/:chatbotId/message', async (req, res) => {
  try {
    const config = chatbotConfigs.get(req.params.chatbotId);
    if (!config) return res.status(404).json({ error: 'Chatbot not found' });
    
    const systemPrompt = `You are an AI assistant for ${config.businessName}.

BUSINESS INFORMATION:
${config.businessInfo}

KNOWLEDGE BASE:
${config.knowledgeBase}

Your role:
1. Answer questions accurately using the provided information
2. Be helpful, friendly, and professional
3. Keep responses concise (2-3 sentences unless more detail is needed)
4. If you don't know something, say so and offer to connect them with staff
5. Always represent ${config.businessName} professionally`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: req.body.message }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    res.json({ response: completion.choices[0].message.content });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      response: "I'm sorry, I encountered an error. Please try again or contact us directly at (808) 374-2131."
    });
  }
});

// List all chatbots (admin)
app.get('/api/admin/chatbots', (req, res) => {
  const chatbots = Array.from(chatbotConfigs.values()).map(c => ({
    id: c.id,
    clientName: c.clientName,
    businessName: c.businessName,
    createdAt: c.createdAt,
    active: c.active
  }));
  res.json({ chatbots });
});

// Start server
await loadConfigs();

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════╗
║  🤖 AUTOMAGIXX CHATBOT SERVER     ║
║  Port: ${PORT}                       ║
║  Active chatbots: ${chatbotConfigs.size}               ║
╚════════════════════════════════════╝
    `);
  });
}

// Export for Vercel
export default app;