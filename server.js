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
        primaryColor: '#FF7F50',
        welcomeMessage: `Hi! I'm ${businessName}'s AI assistant. How can I help you today?`
      },
      createdAt: new Date().toISOString(),
      active: true
    };
    
    chatbotConfigs.set(chatbotId, config);
    await saveConfigs();
    
    const embedCode = `<!-- Automagixx Chatbot -->
<script src="https://automagixx-chatbot-server.vercel.app/embed.js?id=${chatbotId}"></script>`;
    
    res.json({
      success: true,
      chatbotId,
      embedCode,
      previewUrl: `https://automagixx-chatbot-server.vercel.app/widget/${chatbotId}`
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
  
  const primaryColor = config.customization?.primaryColor || '#FF7F50';
  
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
      height: 100vh; 
      display: flex; 
      flex-direction: column;
      background: linear-gradient(135deg, #FFF8DC 0%, #FFE4B5 100%);
    }
    #header { 
      background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%);
      color: white; 
      padding: 16px; 
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    #header-left { flex: 1; }
    #header h3 { font-size: 16px; font-weight: 600; }
    #header p { font-size: 12px; opacity: 0.9; margin-top: 4px; }
    #close-btn {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    #close-btn:hover { background: rgba(255,255,255,0.3); }
    #messages { 
      flex: 1; 
      overflow-y: auto; 
      padding: 16px; 
      display: flex; 
      flex-direction: column; 
      gap: 12px;
    }
    .msg { 
      max-width: 80%; 
      padding: 12px 16px; 
      border-radius: 18px; 
      font-size: 14px; 
      line-height: 1.5;
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .user { 
      background: ${primaryColor};
      color: white; 
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .bot { 
      background: white; 
      color: #1f2937; 
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.08);
    }
    .typing-indicator {
      display: none;
      align-self: flex-start;
      padding: 12px 16px;
      background: white;
      border-radius: 18px;
      border-bottom-left-radius: 4px;
    }
    .typing-indicator.show { display: block; }
    .typing-indicator span {
      height: 8px;
      width: 8px;
      background: #94a3b8;
      border-radius: 50%;
      display: inline-block;
      margin: 0 2px;
      animation: bounce 1.4s infinite;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-8px); }
    }
    #input-area { 
      padding: 16px; 
      background: white;
      border-top: 1px solid #e5e7eb;
    }
    #input-form { display: flex; gap: 8px; align-items: center; }
    #msg-input { 
      flex: 1; 
      padding: 12px 16px; 
      border: 2px solid #e5e7eb; 
      border-radius: 24px; 
      font-size: 14px;
      transition: border-color 0.2s;
    }
    #msg-input:focus { 
      outline: none; 
      border-color: ${primaryColor};
    }
    #send-btn { 
      background: ${primaryColor};
      color: white; 
      border: none; 
      width: 44px;
      height: 44px;
      border-radius: 50%; 
      cursor: pointer; 
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, opacity 0.2s;
    }
    #send-btn:hover { transform: scale(1.1); }
    #send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: scale(1); }
    #branding {
      text-align: center;
      padding: 8px;
      font-size: 11px;
      color: #94a3b8;
      background: white;
    }
    #branding a {
      color: ${primaryColor};
      text-decoration: none;
      font-weight: 500;
    }
    #branding a:hover { text-decoration: underline; }
    
    /* Mobile responsive */
    @media (max-width: 480px) {
      body { background: white; }
      #header { border-radius: 0; }
    }
  </style>
</head>
<body>
  <div id="header">
    <div id="header-left">
      <h3>${config.businessName}</h3>
      <p>🌺 Online • Typically replies instantly</p>
    </div>
    <button id="close-btn" onclick="window.parent.postMessage('minimize', '*')">✕</button>
  </div>
  <div id="messages"></div>
  <div class="typing-indicator" id="typing">
    <span></span><span></span><span></span>
  </div>
  <div id="input-area">
    <form id="input-form">
      <input id="msg-input" placeholder="Type your message..." autocomplete="off" />
      <button id="send-btn" type="submit">➤</button>
    </form>
  </div>
  <div id="branding">
    Powered by <a href="https://automagixx.com" target="_blank">Automagixx</a>
  </div>
  <script>
    const chatId = '${req.params.chatbotId}';
    const messages = document.getElementById('messages');
    const form = document.getElementById('input-form');
    const input = document.getElementById('msg-input');
    const sendBtn = document.getElementById('send-btn');
    const typing = document.getElementById('typing');
    
    // Play notification sound
    function playSound() {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGmm98OScTgwOUKnn77RgGwU7k9nyz3kqBSh+zPLaizsKGGS56+mnUxMJSpzh8sFuJAUqgM3y2Ik3Bxpqve/lnE4MEFCp5++zYBsFO5PZ8s95KgUofszyPUqk3KpBxqrx'); 
      audio.volume = 0.3;
      audio.play().catch(() => {});
    }
    
    // Show welcome message
    setTimeout(() => {
      addMsg('${config.customization.welcomeMessage.replace(/'/g, "\\'")}', 'bot');
    }, 500);
    
    form.onsubmit = async (e) => {
      e.preventDefault();
      const msg = input.value.trim();
      if (!msg) return;
      
      input.value = '';
      sendBtn.disabled = true;
      addMsg(msg, 'user');
      
      // Show typing indicator
      typing.classList.add('show');
      messages.scrollTop = messages.scrollHeight;
      
      try {
        const res = await fetch('/api/chat/' + chatId + '/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg })
        });
        
        if (!res.ok) throw new Error('Network error');
        
        const data = await res.json();
        typing.classList.remove('show');
        addMsg(data.response, 'bot');
        playSound();
        
        // Notify parent window of new message
        window.parent.postMessage('newMessage', '*');
        
      } catch (error) {
        typing.classList.remove('show');
        addMsg('I apologize, but I&apos;m having trouble connecting right now. Please try again in a moment, or call us at (808) 374-2131 for immediate assistance! 🌺', 'bot');
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
2. Be helpful, friendly, and professional with a warm Hawaiian hospitality vibe
3. Keep responses concise (2-3 sentences unless more detail is needed)
4. Use occasional Hawaiian terms like "Aloha" and "Mahalo" when appropriate
5. If you don't know something, say so and offer to connect them with staff
6. Always represent ${config.businessName} professionally`;

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

// Serve embed script
app.get('/embed.js', (req, res) => {
  const botId = req.query.id;
  if (!botId) return res.status(400).send('Missing chatbot ID');
  
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
(function() {
  const botId = '${botId}';
  const baseUrl = 'https://automagixx-chatbot-server.vercel.app';
  
  // Create container
  const container = document.createElement('div');
  container.id = 'automagixx-chat-container';
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = \`
    #automagixx-chat-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #FF7F50 0%, #FF6347 100%);
      color: white;
      border: none;
      font-size: 28px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(255, 127, 80, 0.4);
      z-index: 999998;
      transition: all 0.3s ease;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(255, 127, 80, 0.4); }
      50% { transform: scale(1.05); box-shadow: 0 6px 25px rgba(255, 127, 80, 0.6); }
    }
    #automagixx-chat-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 30px rgba(255, 127, 80, 0.6);
    }
    #automagixx-chat-btn .unread-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      background: #ef4444;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      border: 2px solid white;
      animation: bounce 0.5s;
    }
    @keyframes bounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }
    #automagixx-chat-window {
      display: none;
      position: fixed;
      bottom: 100px;
      right: 20px;
      width: 400px;
      height: 600px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      flex-direction: column;
      overflow: hidden;
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #automagixx-chat-window.show {
      display: flex;
    }
    #automagixx-chat-window iframe {
      width: 100%;
      height: 100%;
      border: 0;
    }
    #automagixx-welcome-bubble {
      position: fixed;
      bottom: 100px;
      right: 90px;
      background: white;
      padding: 12px 16px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999997;
      max-width: 200px;
      animation: slideIn 0.5s ease, fadeOut 0.5s ease 4.5s forwards;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      color: #1f2937;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fadeOut {
      to { opacity: 0; transform: translateX(20px); }
    }
    #automagixx-welcome-bubble::after {
      content: '';
      position: absolute;
      bottom: 10px;
      right: -8px;
      width: 0;
      height: 0;
      border: 8px solid transparent;
      border-left-color: white;
    }
    
    /* Mobile responsive */
    @media (max-width: 480px) {
      #automagixx-chat-window {
        width: 100%;
        height: 100%;
        bottom: 0;
        right: 0;
        border-radius: 0;
      }
      #automagixx-chat-btn {
        bottom: 15px;
        right: 15px;
      }
      #automagixx-welcome-bubble {
        display: none;
      }
    }
  \`;
  
  // Create button
  const button = document.createElement('button');
  button.id = 'automagixx-chat-btn';
  button.innerHTML = '🌺';
  button.setAttribute('aria-label', 'Open chat');
  
  // Create chat window
  const chatWindow = document.createElement('div');
  chatWindow.id = 'automagixx-chat-window';
  
  const iframe = document.createElement('iframe');
  iframe.src = \`\${baseUrl}/widget/\${botId}\`;
  iframe.setAttribute('title', 'Chat widget');
  chatWindow.appendChild(iframe);
  
  // Create welcome bubble
  const welcomeBubble = document.createElement('div');
  welcomeBubble.id = 'automagixx-welcome-bubble';
  welcomeBubble.textContent = '👋 Need help? Chat with us!';
  
  // Toggle chat
  let unreadCount = 0;
  
  button.onclick = () => {
    const isOpen = chatWindow.classList.contains('show');
    if (isOpen) {
      chatWindow.classList.remove('show');
      button.style.display = 'flex';
    } else {
      chatWindow.classList.add('show');
      button.style.display = 'none';
      unreadCount = 0;
      updateBadge();
    }
  };
  
  // Listen for messages from iframe
  window.addEventListener('message', (e) => {
    if (e.data === 'minimize') {
      chatWindow.classList.remove('show');
      button.style.display = 'flex';
    } else if (e.data === 'newMessage') {
      if (!chatWindow.classList.contains('show')) {
        unreadCount++;
        updateBadge();
      }
    }
  });
  
  function updateBadge() {
    let badge = button.querySelector('.unread-badge');
    if (unreadCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'unread-badge';
        button.appendChild(badge);
      }
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    } else if (badge) {
      badge.remove();
    }
  }
  
  // Append elements
  container.appendChild(button);
  container.appendChild(chatWindow);
  container.appendChild(welcomeBubble);
  document.head.appendChild(style);
  document.body.appendChild(container);
  
  // Remove welcome bubble after 5 seconds
  setTimeout(() => {
    welcomeBubble.remove();
  }, 5000);
})();
  `);
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