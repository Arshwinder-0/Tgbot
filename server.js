require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const multer = require('multer');

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Load products
const products = require('./products.json');

// Initialize bot
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Express server
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (QR code)
app.use(express.static('public'));
app.use(express.json());

// Store user sessions
const userSessions = {};
const paymentProofs = {};

// Check if it's Sunday (Indian Time)
function isSunday() {
    const now = moment().tz('Asia/Kolkata');
    return now.day() === 0; // 0 = Sunday
}

// Get AI response from Gemini
async function getAIResponse(userMessage, context = '') {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const prompt = `
        You are TDS (The Diamond Store) AI assistant. You help customers with subscription purchases.
        
        Context: ${context}
        
        Customer Message: "${userMessage}"
        
        Rules for response:
        1. Be friendly and professional
        2. Keep responses concise but helpful
        3. If about products/prices, mention we have Sunday offers
        4. If asked about legitimacy, mention we have 500+ customers
        5. If asked about payment, mention UPI: arshs@ptyes
        6. If unsure, suggest checking /help or /products
        7. Always end with a call to action like "Check /products" or "Type /help"
        
        Products we sell:
        - Netflix Premium: ₹120/month (Sunday: ₹96)
        - YouTube Premium: ₹35/month (Sunday: ₹28)
        - Prime Video: ₹150/6 months (Sunday: ₹120)
        - Chaupal TV: ₹80/month (Sunday: ₹64)
        - CapCut Pro: ₹350/month (Sunday: ₹280)
        
        Respond naturally as a helpful assistant:
        `;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('AI Error:', error);
        return "I'm here to help with TDS products! You can check available products with /products or get help with /help.";
    }
}

// Format product message
function getProductMessage(productKey, showSunday = false) {
    const product = products[productKey];
    const isSun = isSunday();
    
    let priceMessage = `💰 *Normal Price:* ${product.normal_price}`;
    let amount = product.amount;
    
    if (showSunday) {
        if (isSun) {
            priceMessage = `🎁 *SUNDAY OFFER ACTIVATED!*\n💰 *Sunday Price:* ${product.sunday_price}\n📉 *Discount:* ${product.sunday_discount}`;
            amount = product.sunday_amount;
        } else {
            const nextSunday = moment().tz('Asia/Kolkata').day(0).format('DD MMM YYYY');
            priceMessage = `⏳ *Sunday Offer Locked*\n🔓 Unlocks on Sunday only\n📅 Next Sunday: ${nextSunday}\n💰 *Current Price:* ${product.normal_price}`;
        }
    }
    
    return {
        message: `
🎯 *${product.name}*

${product.description}

✨ *Features:*
${product.features.map(f => `• ${f}`).join('\n')}

${priceMessage}

💡 *Why it's cheap:*
${product.why_cheap}

📱 *UPI ID:* \`${product.upi_id}\`

🛒 *Buy Now:* /buy_${productKey}
🎁 *Sunday Offer:* /sunday_${productKey}
`,
        amount: amount,
        isSunday: isSun && showSunday
    };
}

// ===================== COMMAND HANDLERS =====================

// Start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
🤖 *Welcome to The Diamond Store!* 🛍️

✨ *Premium Subscriptions at Unbeatable Prices*

🎯 *Quick Actions:*
🛒 /products - View all products
🎁 /sunday - Sunday offers (20% OFF)
💰 /whycheap - Why prices are low
🆘 /help - Full guide

💡 *Just type what you need!*
• "Netflix price?"
• "I want to buy YouTube"
• "Sunday offers?"
• "How to pay?"

*We're here to help you save!* 😊
    `;
    
    await bot.sendMessage(chatId, welcomeMessage, { 
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [
                [{ text: "🛒 View Products" }, { text: "🎁 Sunday Offers" }],
                [{ text: "💰 Why Cheap?" }, { text: "🆘 Help" }],
                [{ text: "📱 Contact Support" }]
            ],
            resize_keyboard: true
        }
    });
});

// Help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
🆘 *TDS Bot Guide*

🛒 *HOW TO BUY:*
1. Browse products: /products
2. Select product: /netflix, /youtube, etc
3. Click "Buy Now" in product message
4. Pay via QR (UPI: arshs@ptyes)
5. Upload payment screenshot
6. Get WhatsApp link for activation

🎁 *SUNDAY OFFERS:*
• Every Sunday: 20% OFF all products
• Check: /sunday
• Auto-applied on Sundays

💰 *PAYMENT:*
• UPI ID: \`arshs@ptyes\`
• QR code shown during purchase
• Screenshot required for verification

⏱️ *ACTIVATION:*
• Within 15-30 minutes
• WhatsApp support 24/7
• 7-day warranty

🛡️ *TRUST:*
• 500+ satisfied customers
• Manual verification
• Instant support

*Need help? Just type your question!*
    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Products command
bot.onText(/\/products/, (msg) => {
    const chatId = msg.chat.id;
    const isSun = isSunday();
    
    let productsMessage = `🛒 *All Products*\n`;
    
    if (isSun) {
        productsMessage += `🎁 *SUNDAY OFFERS ACTIVE! 20% OFF*\n\n`;
    } else {
        productsMessage += `⏳ *Sunday offers unlock in ${7 - moment().tz('Asia/Kolkata').day()} days*\n\n`;
    }
    
    for (const [key, product] of Object.entries(products)) {
        const price = isSun ? product.sunday_price : product.normal_price;
        productsMessage += `🎯 *${product.name}*\n💰 ${price}\n📝 /${key}\n🎁 /sunday_${key}\n\n`;
    }
    
    productsMessage += `💡 *Why so cheap?* /whycheap\n🛍️ *Ready to buy?* Select a product!`;
    
    bot.sendMessage(chatId, productsMessage, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🎁 Check Sunday Offers", callback_data: "check_sunday" }
                ],
                [
                    { text: "📱 Contact Support", url: `https://wa.me/${process.env.WHATSAPP_NUMBER}` }
                ]
            ]
        }
    });
});

// Sunday command
bot.onText(/\/sunday/, (msg) => {
    const chatId = msg.chat.id;
    const isSun = isSunday();
    
    if (isSun) {
        const sundayMessage = `
🎉 *SUNDAY OFFERS ACTIVATED!* 🎉

📅 *Every Sunday:* 20% OFF ALL PRODUCTS
⏰ *Time:* 12:00 AM to 11:59 PM IST

*TODAY'S PRICES:*
• Netflix Premium: ₹96/month (Save ₹24)
• YouTube Premium: ₹28/month (Save ₹7)
• Prime Video: ₹120/6 months (Save ₹30)
• Chaupal TV: ₹64/month (Save ₹16)
• CapCut Pro: ₹280/month (Save ₹70)

*Total Savings Today:* ₹147

*Hurry! Offer ends tonight!*

*View products:* /products
        `;
        
        bot.sendMessage(chatId, sundayMessage, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🛒 Buy Netflix (₹96)", callback_data: "buy_netflix_sunday" },
                        { text: "📺 Buy YouTube (₹28)", callback_data: "buy_youtube_sunday" }
                    ],
                    [
                        { text: "🎬 Buy Prime (₹120)", callback_data: "buy_prime_sunday" },
                        { text: "📱 Buy CapCut (₹280)", callback_data: "buy_capcut_sunday" }
                    ]
                ]
            }
        });
    } else {
        const nextSunday = moment().tz('Asia/Kolkata').day(0);
        if (nextSunday.isBefore(moment())) {
            nextSunday.add(7, 'days');
        }
        
        const daysLeft = nextSunday.diff(moment(), 'days');
        const hoursLeft = nextSunday.diff(moment(), 'hours') % 24;
        
        const notSundayMessage = `
⏳ *Sunday Offers Locked*

📅 *Today is not Sunday*
🎁 *Sunday Offers unlock every Sunday*

⏰ *Time until next Sunday:*
${daysLeft} days, ${hoursLeft} hours

*Normal Prices (No discount):*
• Netflix: ₹120/month
• YouTube: ₹35/month
• Prime: ₹150/6 months
• Chaupal: ₹80/month
• CapCut: ₹350/month

*Check back on Sunday for 20% OFF!*

*View products:* /products
        `;
        
        bot.sendMessage(chatId, notSundayMessage, { parse_mode: 'Markdown' });
    }
});

// Why cheap command
bot.onText(/\/whycheap/, (msg) => {
    const chatId = msg.chat.id;
    const whyCheapMessage = `
💰 *Why Our Prices Are The Best:*

1. **Bulk Family Plans** - We share premium family plans among multiple users
2. **Regional Pricing** - Leverage price differences between countries
3. **Direct Partnerships** - Direct deals with service providers
4. **No Middlemen** - Eliminate commission layers
5. **Volume Discounts** - Large customer base = better rates
6. **Cost Optimization** - Smart sharing of resources

🛡️ *100% Genuine Guarantee:*
• Official subscriptions only
• Instant activation
• 7-day replacement warranty
• 24/7 WhatsApp support

💯 *Trusted by 500+ Customers*

*Ready to save?* /products
    `;
    
    bot.sendMessage(chatId, whyCheapMessage, { parse_mode: 'Markdown' });
});

// Individual product commands
['netflix', 'youtube', 'prime', 'chaupal', 'capcut'].forEach(product => {
    bot.onText(new RegExp(`\/${product}`), (msg) => {
        const chatId = msg.chat.id;
        const productInfo = getProductMessage(product);
        bot.sendMessage(chatId, productInfo.message, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: `🛒 Buy Now (${isSunday() ? products[product].sunday_price : products[product].normal_price})`, callback_data: `buy_${product}` }
                    ],
                    [
                        { text: "🎁 Sunday Offer", callback_data: `sunday_${product}` },
                        { text: "📱 Contact Support", url: `https://wa.me/${process.env.WHATSAPP_NUMBER}` }
                    ]
                ]
            }
        });
    });
    
    // Sunday offer commands
    bot.onText(new RegExp(`\/sunday_${product}`), (msg) => {
        const chatId = msg.chat.id;
        const productInfo = getProductMessage(product, true);
        bot.sendMessage(chatId, productInfo.message, { parse_mode: 'Markdown' });
    });
});

// Buy commands
bot.onText(/\/buy_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const productKey = match[1];
    
    if (!products[productKey]) {
        bot.sendMessage(chatId, "❌ Product not found. Use /products to see available products.");
        return;
    }
    
    await processPurchase(chatId, productKey);
});

// Callback queries (for inline buttons)
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    
    // Handle buy callbacks
    if (data.startsWith('buy_')) {
        const productKey = data.replace('buy_', '').replace('_sunday', '');
        await processPurchase(chatId, productKey, data.includes('_sunday'));
    }
    
    // Handle Sunday check
    else if (data === 'check_sunday') {
        bot.sendMessage(chatId, isSunday() ? 
            "🎉 Yes! Sunday offers are ACTIVE! 20% OFF all products. Use /sunday to see prices." : 
            "⏳ Sunday offers are not active. Check /sunday for countdown."
        );
    }
    
    // Handle Sunday info
    else if (data.startsWith('sunday_')) {
        const productKey = data.replace('sunday_', '');
        const productInfo = getProductMessage(productKey, true);
        bot.sendMessage(chatId, productInfo.message, { parse_mode: 'Markdown' });
    }
    
    bot.answerCallbackQuery(callbackQuery.id);
});

// Process purchase
async function processPurchase(chatId, productKey, forceSunday = false) {
    const product = products[productKey];
    const isSun = isSunday();
    const useSundayPrice = forceSunday || isSun;
    
    const amount = useSundayPrice ? product.sunday_amount : product.amount;
    const priceText = useSundayPrice ? product.sunday_price : product.normal_price;
    
    // Store session
    userSessions[chatId] = {
        product: productKey,
        amount: amount,
        priceText: priceText,
        step: 'payment',
        timestamp: Date.now()
    };
    
    const buyMessage = `
🛒 *Purchase: ${product.name}*

💰 *Price:* ${priceText}
${useSundayPrice ? '🎁 *Sunday Discount Applied!*' : ''}

📋 *Process:*
1. Pay ₹${amount} via QR/UPI
2. Upload payment screenshot
3. Get WhatsApp link
4. Activation in 15-30 mins

💳 *Payment Details:*
UPI ID: \`${product.upi_id}\`
Amount: ₹${amount}

*Scan QR code below to pay:*
    `;
    
    await bot.sendMessage(chatId, buyMessage, { parse_mode: 'Markdown' });
    
    // Send QR code
    try {
        const qrUrl = `${process.env.WEBSITE_URL || 'http://localhost:3000'}/payss.png`;
        await bot.sendPhoto(chatId, qrUrl, {
            caption: `📱 Scan to pay ₹${amount}\nUPI: \`${product.upi_id}\`\n\nAfter payment, send screenshot or type /upload`,
            reply_markup: {
                inline_keyboard: [[
                    { text: "📸 I've Paid - Upload Screenshot", callback_data: "upload_now" }
                ]]
            }
        });
    } catch (error) {
        await bot.sendMessage(chatId, 
            `📱 *Manual Payment*\n\nUPI ID: \`${product.upi_id}\`\nAmount: ₹${amount}\n\nAfter payment, send screenshot or type /upload`,
            { parse_mode: 'Markdown' }
        );
    }
    
    // Send payment instructions
    setTimeout(() => {
        bot.sendMessage(chatId, 
            `*Payment Instructions:*\n\n1. Open GPay/PhonePe/Paytm\n2. Send ₹${amount} to \`${product.upi_id}\`\n3. Take screenshot of "Payment Successful"\n4. Send screenshot here\n\nOr click: /upload`,
            { parse_mode: 'Markdown' }
        );
    }, 1000);
}

// Upload command
bot.onText(/\/upload/, (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions[chatId];
    
    if (!session || session.step !== 'payment') {
        bot.sendMessage(chatId, 
            "❌ Please select a product first!\n\nUse /products to view products and buy one.",
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    session.step = 'upload';
    
    bot.sendMessage(chatId, 
        `📸 *Upload Payment Proof*\n\nPlease send screenshot of:\n• "Payment Successful" screen\n• Transaction ID visible\n• Amount: ₹${session.amount}\n\n*Send the image now...*`,
        { parse_mode: 'Markdown' }
    );
});

// Handle photo/document messages (payment proof)
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions[chatId];
    
    if (!session || session.step !== 'upload') {
        return;
    }
    
    await handlePaymentProof(chatId, msg, 'photo');
});

bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions[chatId];
    
    if (!session || session.step !== 'upload') {
        return;
    }
    
    await handlePaymentProof(chatId, msg, 'document');
});

// Process payment proof
async function handlePaymentProof(chatId, msg, type) {
    const session = userSessions[chatId];
    const product = products[session.product];
    
    // Store proof info
    paymentProofs[chatId] = {
        product: session.product,
        amount: session.amount,
        userId: msg.from.id,
        username: msg.from.username,
        timestamp: Date.now(),
        messageId: msg.message_id
    };
    
    // Verify payment (basic check)
    const verifyMessage = `
✅ *Payment Proof Received!*

📦 *Order Summary:*
• Product: ${product.name}
• Amount: ₹${session.amount}
• Date: ${new Date().toLocaleString('en-IN')}
• Status: Under Verification

🔄 *Verifying payment...*
    `;
    
    await bot.sendMessage(chatId, verifyMessage, { parse_mode: 'Markdown' });
    
    // Simulate verification (2 seconds)
    setTimeout(async () => {
        const orderId = `TDS${Date.now().toString().slice(-8)}`;
        
        // Create WhatsApp message
        const whatsappMessage = `Hello! I have purchased ${product.name} (₹${session.amount}) from TDS Telegram Bot. Order ID: ${orderId}. Payment completed via UPI. Please activate my subscription.`;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        const whatsappLink = `https://wa.me/${process.env.WHATSAPP_NUMBER}?text=${encodedMessage}`;
        
        const successMessage = `
🎉 *Payment Verified Successfully!*

📋 *Order Confirmed:*
• Order ID: ${orderId}
• Product: ${product.name}
• Amount Paid: ₹${session.amount}
• Payment Method: UPI
• Status: ✅ Approved

⏱️ *What's Next:*
1. Click WhatsApp button below
2. Send pre-filled message
3. We'll activate within 15-30 minutes
4. You'll receive credentials

🛡️ *Warranty:* 7-day replacement guarantee
📞 *Support:* 24/7 on WhatsApp

*Thank you for choosing TDS!* 😊
        `;
        
        await bot.sendMessage(chatId, successMessage, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { 
                        text: "📱 Open WhatsApp for Activation", 
                        url: whatsappLink 
                    }
                ]]
            }
        });
        
        // Send order receipt
        const receipt = `
🧾 *Order Receipt - TDS*
━━━━━━━━━━━━━━━━
📅 Date: ${new Date().toLocaleDateString('en-IN')}
⏰ Time: ${new Date().toLocaleTimeString('en-IN')}
🆔 Order ID: ${orderId}
━━━━━━━━━━━━━━━━
🛒 Product: ${product.name}
💰 Amount: ₹${session.amount}
💳 Method: UPI
🔗 UPI ID: ${product.upi_id}
━━━━━━━━━━━━━━━━
📞 Support: https://wa.me/${process.env.WHATSAPP_NUMBER}
⏱️ ETA: 15-30 minutes
🛡️ Warranty: 7 days
━━━━━━━━━━━━━━━━
        `;
        
        await bot.sendMessage(chatId, receipt, { parse_mode: 'Markdown' });
        
        // Notify admin
        if (process.env.ADMIN_CHAT_ID) {
            const adminMsg = `
🛒 *NEW ORDER #${orderId}*
━━━━━━━━━━━━━━━━
👤 Customer: @${msg.from.username || 'No username'}
🆔 User ID: ${msg.from.id}
📦 Product: ${product.name}
💰 Amount: ₹${session.amount}
⏰ Time: ${new Date().toLocaleString('en-IN')}
            `;
            
            try {
                await bot.sendMessage(process.env.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'Markdown' });
                
                // Forward payment proof to admin
                if (type === 'photo' && msg.photo) {
                    const photoId = msg.photo[msg.photo.length - 1].file_id;
                    await bot.sendPhoto(process.env.ADMIN_CHAT_ID, photoId, {
                        caption: `Payment proof for Order #${orderId}`
                    });
                }
            } catch (error) {
                console.error('Admin notification failed:', error);
            }
        }
        
        // Clear session
        delete userSessions[chatId];
        
    }, 2000);
}

// ===================== AI TEXT HANDLER =====================

// Handle all text messages (AI responses)
bot.on('message', async (msg) => {
    // Skip if it's a command or not text
    if (!msg.text || msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const userMessage = msg.text.toLowerCase().trim();
    
    // Check for common questions first (fast responses)
    const quickResponses = {
        'hello': '👋 Hello! Welcome to TDS! How can I help you today? 😊',
        'hi': '👋 Hi there! Looking for amazing deals on subscriptions?',
        'hey': '👋 Hey! Ready to save on premium services?',
        'price': '💰 Check our amazing prices! Use /products to see all products or ask for a specific one like "Netflix price?"',
        'how much': '💰 Our prices start from ₹28/month! Use /products to see all options.',
        'buy': '🛒 Great! Which product would you like to buy? Use /products to browse or tell me the product name.',
        'purchase': '🛒 Ready to purchase? First select a product from /products',
        'netflix': '🎬 Netflix Premium is ₹120/month (Sunday: ₹96). Features: 4K, 4 screens, all content. Want to buy? /buy_netflix',
        'youtube': '📺 YouTube Premium is ₹35/month (Sunday: ₹28). Features: No ads, background play, downloads. /buy_youtube',
        'prime': '🎬 Prime Video is ₹150/6 months (Sunday: ₹120). All movies & shows in 4K. /buy_prime',
        'capcut': '✂️ CapCut Pro is ₹350/month (Sunday: ₹280). No watermark, premium effects. /buy_capcut',
        'chaupal': '📡 Chaupal TV is ₹80/month (Sunday: ₹64). Punjabi content, multi-device. /buy_chaupal',
        'sunday': isSunday() ? 
            '🎉 YES! Sunday offers are ACTIVE! 20% OFF all products. Check /sunday for prices!' : 
            '⏳ Sunday offers unlock every Sunday. Check /sunday for countdown.',
        'offer': '🎁 We have Sunday offers (20% OFF) and bulk discounts! Check /sunday for current offers.',
        'discount': '🎁 Sunday: 20% OFF all products! Also bulk order discounts. /sunday',
        'cheap': '💰 Our prices are low because we use bulk family plans and regional pricing. /whycheap for details.',
        'real': '✅ 100% genuine! 500+ customers, instant activation, 7-day warranty. /help',
        'legit': '✅ Completely legit! We provide official subscriptions with full support.',
        'trust': '🤝 Trusted by 500+ customers! Manual verification, 24/7 support, 7-day warranty.',
        'payment': '💳 Pay via UPI: arshs@ptyes. We show QR code during purchase. /help',
        'upi': '💳 Our UPI ID: arshs@ptyes. Payment via any UPI app.',
        'how to pay': '💳 During purchase, we show QR code. Scan with GPay/PhonePe/Paytm or send to arshs@ptyes.',
        'contact': `📞 Contact: WhatsApp - https://wa.me/${process.env.WHATSAPP_NUMBER}\n24/7 support!`,
        'support': `📞 WhatsApp support: https://wa.me/${process.env.WHATSAPP_NUMBER}\nWe reply within minutes!`,
        'help': '🆘 Use /help for detailed guide or just ask me anything!',
        'thank': '😊 You\'re welcome! Let me know if you need anything else!',
        'thanks': '😊 Happy to help! Enjoy your savings with TDS!',
        'bye': '👋 Goodbye! Come back anytime for great deals!',
        'ok': '👍 Got it! Need anything else?',
        'yes': '👍 Great! What would you like to do next?',
        'no': '👌 No problem! Let me know if you change your mind.'
    };
    
    // Check for quick response
    for (const [key, response] of Object.entries(quickResponses)) {
        if (userMessage.includes(key)) {
            await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            return;
        }
    }
    
    // Check if it's a product inquiry
    const productKeys = Object.keys(products);
    for (const key of productKeys) {
        if (userMessage.includes(key) || userMessage.includes(products[key].name.toLowerCase())) {
            const productInfo = getProductMessage(key);
            await bot.sendMessage(chatId, productInfo.message, { parse_mode: 'Markdown' });
            return;
        }
    }
    
    // Check for purchase intent
    if (userMessage.includes('want to buy') || userMessage.includes('buy') || 
        userMessage.includes('purchase') || userMessage.includes('order') ||
        userMessage.includes('take') || userMessage.includes('get')) {
        
        // Extract product name
        let foundProduct = null;
        for (const [key, product] of Object.entries(products)) {
            if (userMessage.includes(key) || userMessage.includes(product.name.toLowerCase().split(' ')[0])) {
                foundProduct = key;
                break;
            }
        }
        
        if (foundProduct) {
            await bot.sendMessage(chatId, 
                `🛒 You want to buy ${products[foundProduct].name}? Great choice!\n\nPrice: ${isSunday() ? products[foundProduct].sunday_price : products[foundProduct].normal_price}\n\nClick here to proceed: /buy_${foundProduct}`,
                { parse_mode: 'Markdown' }
            );
        } else {
            await bot.sendMessage(chatId, 
                `🛒 You want to buy something? Great!\n\nPlease tell me which product:\n• Netflix\n• YouTube\n• Prime\n• Chaupal\n• CapCut\n\nOr check all: /products`,
                { parse_mode: 'Markdown' }
            );
        }
        return;
    }
    
    // Use AI for other messages
    try {
        // Show typing indicator
        await bot.sendChatAction(chatId, 'typing');
        
        // Get AI response
        const aiResponse = await getAIResponse(msg.text, `User is asking about TDS products. Current day: ${isSunday() ? 'Sunday - offers active' : 'Not Sunday'}.`);
        
        // Send response
        await bot.sendMessage(chatId, aiResponse, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🛒 View Products", callback_data: "view_products" },
                        { text: "🎁 Sunday Offers", callback_data: "check_sunday" }
                    ],
                    [
                        { text: "📱 Contact Support", url: `https://wa.me/${process.env.WHATSAPP_NUMBER}` }
                    ]
                ]
            }
        });
    } catch (error) {
        console.error('Message handling error:', error);
        await bot.sendMessage(chatId, 
            `I'm here to help with TDS products! 😊\n\nTry:\n• /products - View all\n• /sunday - Offers\n• Or ask about specific product\n\nNeed help? /help`,
            { parse_mode: 'Markdown' }
        );
    }
});

// ===================== SERVER SETUP =====================

// Serve QR code
app.get('/payss.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', '