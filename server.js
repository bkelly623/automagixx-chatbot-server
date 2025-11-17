import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

// Embed script with clickable prompts
app.get('/embed.js', (req, res) => {
  const chatbotId = req.query.id;
  if (!chatbotId) return res.status(400).send('Missing chatbot ID');
  
  const config = chatbotConfigs.get(chatbotId);
  if (!config) return res.status(404).send('Chatbot not found');

  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
(function() {
  const chatbotId = '${chatbotId}';
  const primaryColor = '#E53935'; // Dark coral red
  const accentColor = '#26C6DA'; // Turquoise
  
  // Generate unique conversation ID
  let conversationId = sessionStorage.getItem('chatbot_conversation_id');
  if (!conversationId) {
    conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('chatbot_conversation_id', conversationId);
  }
  
  // Create container
  const container = document.createElement('div');
  container.id = 'automagixx-chat-container';
  
  // Styles
  const style = document.createElement('style');
  style.textContent = \`
    #automagixx-chat-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: \${primaryColor};
      color: white;
      border: none;
      font-size: 28px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(229, 57, 53, 0.4);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      animation: pulse 2s infinite;
    }
    
    #automagixx-chat-button:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 20px rgba(229, 57, 53, 0.5);
    }
    
    @keyframes pulse {
      0%, 100% { box-shadow: 0 4px 12px rgba(229, 57, 53, 0.4); }
      50% { box-shadow: 0 4px 20px rgba(229, 57, 53, 0.6); }
    }
    
    #automagixx-welcome-bubble {
      position: fixed;
      bottom: 95px;
      right: 20px;
      background: white;
      padding: 12px 16px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9998;
      max-width: 250px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      color: #333;
      animation: slideIn 0.3s ease-out;
      display: none;
    }
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    #automagixx-welcome-bubble::after {
      content: '';
      position: absolute;
      bottom: -8px;
      right: 25px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid white;
    }
    
    #automagixx-chat-window {
      display: none;
      position: fixed;
      bottom: 100px;
      right: 20px;
      width: 400px;
      height: 600px;
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 140px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      z-index: 9999;
      flex-direction: column;
      animation: slideUp 0.3s ease-out;
    }
    
    @media (max-width: 768px) {
      #automagixx-chat-window {
        width: 100vw;
        height: 100vh;
        max-width: 100vw;
        max-height: 100vh;
        bottom: 0;
        right: 0;
        border-radius: 0;
      }
    }
    
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    #automagixx-chat-header {
      background: linear-gradient(135deg, \${primaryColor} 0%, #C62828 100%);
      color: white;
      padding: 16px;
      border-radius: 16px 16px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    #automagixx-chat-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    
    #automagixx-chat-header p {
      margin: 4px 0 0 0;
      font-size: 12px;
      opacity: 0.9;
    }
    
    #automagixx-close-btn {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s;
    }
    
    #automagixx-close-btn:hover {
      background: rgba(255,255,255,0.2);
    }
    
    #automagixx-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f8f9fa;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .automagixx-message {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      animation: fadeIn 0.3s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .automagixx-message.user {
      background: \${primaryColor};
      color: white;
      align-self: flex-end;
      margin-left: auto;
    }
    
    .automagixx-message.bot {
      background: white;
      color: #1f2937;
      align-self: flex-start;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    
    .automagixx-typing {
      background: white;
      padding: 12px 16px;
      border-radius: 12px;
      align-self: flex-start;
      display: flex;
      gap: 4px;
      align-items: center;
    }
    
    .automagixx-typing span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #9CA3AF;
      animation: bounce 1.4s infinite ease-in-out both;
    }
    
    .automagixx-typing span:nth-child(1) { animation-delay: -0.32s; }
    .automagixx-typing span:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
    
    .automagixx-prompts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    
    .automagixx-prompt-btn {
      background: white;
      border: 1px solid #e5e7eb;
      color: \${primaryColor};
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    
    .automagixx-prompt-btn:hover {
      background: \${primaryColor};
      color: white;
      border-color: \${primaryColor};
    }
    
    #automagixx-input-area {
      padding: 16px;
      border-top: 1px solid #e5e7eb;
      background: white;
      border-radius: 0 0 16px 16px;
    }
    
    #automagixx-input-form {
      display: flex;
      gap: 8px;
    }
    
    #automagixx-input {
      flex: 1;
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }
    
    #automagixx-input:focus {
      border-color: \${primaryColor};
    }
    
    #automagixx-send-btn {
      background: \${primaryColor};
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
    }
    
    #automagixx-send-btn:hover {
      background: #C62828;
    }
    
    #automagixx-send-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    #automagixx-branding {
      text-align: center;
      padding: 8px;
      font-size: 11px;
      color: #9CA3AF;
      border-top: 1px solid #f3f4f6;
    }
    
    #automagixx-branding a {
      color: \${primaryColor};
      text-decoration: none;
    }
  \`;
  
  document.head.appendChild(style);
  
  // Create button
  const button = document.createElement('button');
  button.id = 'automagixx-chat-button';
  button.innerHTML = '💬';
  button.setAttribute('aria-label', 'Chat with us');
  
  // Create welcome bubble
  const welcomeBubble = document.createElement('div');
  welcomeBubble.id = 'automagixx-welcome-bubble';
  welcomeBubble.textContent = 'Need help? Chat with us!';
  
  // Create chat window
  const chatWindow = document.createElement('div');
  chatWindow.id = 'automagixx-chat-window';
  
  chatWindow.innerHTML = \`
    <div id="automagixx-chat-header">
      <div>
        <h3>${config.businessName}</h3>
        <p>AI Assistant • Online</p>
      </div>
      <button id="automagixx-close-btn" aria-label="Close chat">×</button>
    </div>
    <div id="automagixx-messages"></div>
    <div id="automagixx-input-area">
      <form id="automagixx-input-form">
        <input 
          id="automagixx-input" 
          type="text" 
          placeholder="Type your message..." 
          autocomplete="off"
          aria-label="Message input"
        />
        <button id="automagixx-send-btn" type="submit">Send</button>
      </form>
    </div>
    <div id="automagixx-branding">
      Powered by <a href="https://automagixx.com" target="_blank">Automagixx</a>
    </div>
  \`;
  
  // Append elements
  container.appendChild(button);
  container.appendChild(welcomeBubble);
  container.appendChild(chatWindow);
  document.body.appendChild(container);
  
  // Get elements
  const messagesDiv = document.getElementById('automagixx-messages');
  const inputForm = document.getElementById('automagixx-input-form');
  const input = document.getElementById('automagixx-input');
  const sendBtn = document.getElementById('automagixx-send-btn');
  const closeBtn = document.getElementById('automagixx-close-btn');
  
  // Show welcome bubble after 1 second, hide after 10 seconds
  setTimeout(() => {
    welcomeBubble.style.display = 'block';
    setTimeout(() => {
      welcomeBubble.style.display = 'none';
    }, 10000);
  }, 1000);
  
  // Toggle chat
  function openChat() {
    chatWindow.style.display = 'flex';
    button.style.display = 'none';
    welcomeBubble.style.display = 'none';
    input.focus();
    
    // Show welcome message if first time
    if (messagesDiv.children.length === 0) {
      addMessage('${config.customization.welcomeMessage.replace(/'/g, "\\'")}', 'bot');
      showInitialPrompts();
    }
  }
  
  function closeChat() {
    chatWindow.style.display = 'none';
    button.style.display = 'flex';
  }
  
  button.addEventListener('click', openChat);
  closeBtn.addEventListener('click', closeChat);
  
  // Initial prompt buttons
  function showInitialPrompts() {
    const prompts = [
      'What are your room prices?',
      'What time is check-in?',
      'Do you have parking?',
      'How far from the beach?',
      'Do you have private rooms?',
      'What activities are nearby?'
    ];
    
    const promptsContainer = document.createElement('div');
    promptsContainer.className = 'automagixx-prompts';
    
    prompts.forEach(prompt => {
      const btn = document.createElement('button');
      btn.className = 'automagixx-prompt-btn';
      btn.textContent = prompt;
      btn.onclick = () => {
        sendMessage(prompt);
        promptsContainer.remove();
      };
      promptsContainer.appendChild(btn);
    });
    
    messagesDiv.appendChild(promptsContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  
  // Add message to chat
  function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = \`automagixx-message \${sender}\`;
    msgDiv.textContent = text;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  
  // Show typing indicator
  function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'automagixx-typing';
    typingDiv.id = 'automagixx-typing-indicator';
    typingDiv.innerHTML = '<span></span><span></span><span></span>';
    messagesDiv.appendChild(typingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  
  function hideTyping() {
    const typingDiv = document.getElementById('automagixx-typing-indicator');
    if (typingDiv) typingDiv.remove();
  }
  
  // Send message
  async function sendMessage(message) {
    if (!message.trim()) return;
    
    addMessage(message, 'user');
    input.value = '';
    sendBtn.disabled = true;
    
    showTyping();
    
    try {
      const response = await fetch('https://automagixx-chatbot-server.vercel.app/api/chat/${chatbotId}/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message,
          conversationId
        })
      });
      
      const data = await response.json();
      hideTyping();
      addMessage(data.response, 'bot');
    } catch (error) {
      hideTyping();
      addMessage("Sorry, I'm having trouble connecting. Please try again or contact us at (808) 374-2131.", 'bot');
    }
    
    sendBtn.disabled = false;
    input.focus();
  }
  
  // Form submit
  inputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });
})();
  `);
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
        primaryColor: '#E53935',
        accentColor: '#26C6DA',
        welcomeMessage: `Aloha! 🌺 I'm here to help with any questions about ${businessName}. What would you like to know?`
      },
      createdAt: new Date().toISOString(),
      active: true
    };
    
    chatbotConfigs.set(chatbotId, config);
    await saveConfigs();
    
    const embedCode = `<!-- Automagixx Chatbot -->
<script src="https://automagixx-chatbot-server.vercel.app/embed.js?id=${chatbotId}" async></script>`;
    
    res.json({
      success: true,
      chatbotId,
      embedCode,
      previewUrl: `https://automagixx.com/test-chatbot?id=${chatbotId}`
    });
    
  } catch (error) {
    console.error('Error creating chatbot:', error);
    res.status(500).json({ error: 'Failed to create chatbot' });
  }
});

// Handle chat messages with Supabase logging
app.post('/api/chat/:chatbotId/message', async (req, res) => {
  try {
    const config = chatbotConfigs.get(req.params.chatbotId);
    if (!config) return res.status(404).json({ error: 'Chatbot not found' });
    
    const userMessage = req.body.message;
    const conversationId = req.body.conversationId;
    
    // Log user message to database
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        chatbot_id: req.params.chatbotId,
        role: 'user',
        content: userMessage
      });
    
    if (messageError) console.error('Error logging user message:', messageError);
    
    // Detect intent from message
    const userMessageLower = userMessage.toLowerCase();
    const isPriceInquiry = userMessageLower.includes('price') || userMessageLower.includes('cost') || userMessageLower.includes('rate') || userMessageLower.includes('expensive');
    const isAvailabilityInquiry = userMessageLower.includes('available') || userMessageLower.includes('book') || userMessageLower.includes('reserve');
    const isRoomInquiry = userMessageLower.includes('room') || userMessageLower.includes('bed') || userMessageLower.includes('dorm') || userMessageLower.includes('private');
    
    // Sales mode indicators
    const isSalesMode = isPriceInquiry || isAvailabilityInquiry || isRoomInquiry;
    
    const systemPrompt = `You are an AI assistant for ${config.businessName}.

BUSINESS INFORMATION:
${config.businessInfo}

KNOWLEDGE BASE:
${config.knowledgeBase}

CONVERSATION STYLE:
${isSalesMode ? `
- Be enthusiastic and helpful
- Highlight value and benefits
- Compare to alternatives when relevant (e.g., "cheaper than hotels!")
- Create subtle urgency when appropriate
- End responses with a soft call-to-action or question to keep conversation going
- Example: "We're located right on the beach with FREE parking and WiFi - way better value than hotels! When are you thinking of visiting?"
` : `
- Be friendly and helpful
- Provide clear, accurate information
- Offer proactive suggestions
- Keep responses concise but warm
- Example: "Check-in is at 3pm! If you arrive early, we have free luggage storage. Need any beach recommendations for your stay?"
`}

IMPORTANT RULES:
1. Keep responses to 2-3 sentences maximum unless more detail is specifically requested
2. Be warm and conversational, not robotic
3. If you don't know something, say so and offer to connect them with staff
4. Always represent ${config.businessName} professionally
5. Use emojis sparingly (🏖️ 🌺 only when appropriate)`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    const botResponse = completion.choices[0].message.content;
    
    // Log bot response to database
    const { error: botMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        chatbot_id: req.params.chatbotId,
        role: 'assistant',
        content: botResponse
      });
    
    if (botMessageError) console.error('Error logging bot message:', botMessageError);
    
    // Update or create conversation record
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('message_count')
      .eq('id', conversationId)
      .single();
    
    if (existingConv) {
      // Update existing conversation
      await supabase
        .from('conversations')
        .update({ 
          message_count: existingConv.message_count + 2,
          ended_at: new Date().toISOString()
        })
        .eq('id', conversationId);
    } else {
      // Create new conversation
      await supabase
        .from('conversations')
        .insert({
          id: conversationId,
          chatbot_id: req.params.chatbotId,
          message_count: 2,
          language_detected: 'en'
        });
    }
    
    res.json({ response: botResponse });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      response: "I'm sorry, I encountered an error. Please try again or contact us directly at (808) 374-2131."
    });
  }
});

// Analytics API endpoint
app.get('/api/analytics/:chatbotId', async (req, res) => {
  try {
    const { chatbotId } = req.params;
    const { days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get total conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .gte('started_at', startDate.toISOString());
    
    if (convError) throw convError;
    
    // Get all messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });
    
    if (msgError) throw msgError;
    
    // Calculate top questions (user messages only)
    const userMessages = messages.filter(m => m.role === 'user');
    const questionCounts = {};
    userMessages.forEach(msg => {
      const question = msg.content.substring(0, 100); // First 100 chars
      questionCounts[question] = (questionCounts[question] || 0) + 1;
    });
    
    const topQuestions = Object.entries(questionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }));
    
    res.json({
      totalConversations: conversations.length,
      totalMessages: messages.length,
      topQuestions,
      recentMessages: messages.slice(0, 20)
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
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
║  Database: Supabase Connected     ║
╚════════════════════════════════════╝
    `);
  });
}

// Export for Vercel
export default app;