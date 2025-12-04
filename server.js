require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

// Load products
const products = require('./products.json');

// Initialize bot
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Express server for webhooks (optional)
const app = express();
const PORT = process.env.PORT || 3000;

// Store user sessions
const userSessions = {};

// Check if it's Sunday (Indian Time)
function isSunday() {
    const now = moment().tz('Asia/Kolkata');
    return now.day() === 0; // 0 = Sunday
}

// Format product message
function getProductMessage(productKey, showSunday = false) {
    const product = products[productKey];
    const isSun = isSunday();
    
    let priceMessage = `💰 *Normal Price:* ${product.normal_price}`;
    
    if (showSunday) {
        if (isSun) {
            priceMessage = `🎁 *SUNDAY OFFER ACTIVATED!*\n💰 *Sunday Price:* ${product.sunday_price}\n📉 *Discount:* ${product.sunday_discount}`;
        } else {
            priceMessage = `⏳ *Sunday Offer Not Available*\n🔓 Unlocks only on Sundays\n💰 *Current Price:* ${product.normal_price}`;
        }
    }
    
    return `
🎯 *${product.name}*

${product.description}

✨ *Features:*
${product.features.map(f => `• ${f}`).join('\n')}

${priceMessage}

💡 *Why it's cheap:*
${product.why_cheap}

📱 *To purchase:* Click /buy_${productKey}
🎁 *Sunday Offer:* Click /sunday_${productKey}
`;
}

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
🤖 *Welcome to The Diamond Store!*

✨ *Your Trusted Source for Premium Subscriptions*

🛒 *Available Products:*
1. /netflix - Netflix Premium
2. /youtube - YouTube Premium  
3. /prime - Prime Video
4. /chaupal - Chaupal TV
5. /capcut - CapCut Pro

🎁 *Sunday Special:* All products 20% OFF every Sunday!
💰 *Why Cheap?* Click /whycheap
🛍️ *View All Products:* /products
💬 *Help:* /help

*Select a product or ask me anything!*
    `;
    
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
🆘 *How to Use This Bot:*

1. *Browse Products:*
   • /products - View all products
   • /netflix, /youtube, etc - View specific product

2. *Sunday Offers:*
   • /sunday - Check Sunday offers
   • /sunday_netflix - Sunday price for Netflix

3. *Purchase Process:*
   • Select product
   • Click "Buy Now"
   • Complete payment via QR
   • Upload payment proof
   • Get WhatsApp link for activation

4. *Other Commands:*
   • /whycheap - Why our prices are low
   • /offers - Current offers
   • /payment - Payment methods
   • /contact - Contact support

💡 *Tip:* Type the product name to get details!
    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Why cheap command
bot.onText(/\/whycheap/, (msg) => {
    const chatId = msg.chat.id;
    const whyCheapMessage = `
🎯 *Why Our Prices Are The Best:*

1. *Bulk Purchasing:* We buy subscriptions in bulk from official sources
2. *Family/Team Plans:* We optimize shared plans to reduce individual costs  
3. *Regional Pricing:* We leverage regional pricing differences
4. *Direct Partnerships:* Some services through direct partnerships
5. *No Middlemen:* We cut out intermediaries to save costs
6. *Volume Discounts:* Higher volumes = better rates
7. *Cost Sharing:* Multiple users share single premium accounts

✅ *100% Genuine Subscriptions*
⚡ *Instant Activation*
🛡️ *7-Day Warranty*

*All subscriptions are official and come with instant activation!*
    `;
    
    bot.sendMessage(chatId, whyCheapMessage, { parse_mode: 'Markdown' });
});

// Check Sunday offers
bot.onText(/\/sunday/, (msg) => {
    const chatId = msg.chat.id;
    const isSun = isSunday();
    
    if (isSun) {
        const sundayMessage = `
🎉 *SUNDAY OFFERS ACTIVATED!* 🎉

*All products 20% OFF today!*

📅 *Offer Valid:* Every Sunday
⏰ *Time:* 12:00 AM to 11:59 PM (IST)

*Sunday Prices:*
• Netflix Premium: ₹96/month (Save ₹24)
• YouTube Premium: ₹28/month (Save ₹7)  
• Prime Video: ₹120/6 months (Save ₹30)
• Chaupal TV: ₹64/month (Save ₹16)
• CapCut Pro: Special Sunday Price

*View Sunday offers:*
/sunday_netflix
/sunday_youtube  
/sunday_prime
/sunday_chaupal
/sunday_capcut

*Hurry! Offer ends tonight!*
        `;
        bot.sendMessage(chatId, sundayMessage, { parse_mode: 'Markdown' });
    } else {
        const nextSunday = moment().tz('Asia/Kolkata').day(0).format('DD MMM YYYY');
        const notSundayMessage = `
⏳ *Sunday Offers Not Available*

📅 *Today is not Sunday*
🎁 *Sunday Offers unlock every Sunday*

*Next Sunday:* ${nextSunday}

*Current Prices (No discount):*
/netflix - ₹120/month
/youtube - ₹35/month  
/prime - ₹150/6 months
/chaupal - ₹80/month

*Check back on Sunday for 20% OFF!*
        `;
        bot.sendMessage(chatId, notSundayMessage, { parse_mode: 'Markdown' });
    }
});

// Individual product commands
bot.onText(/\/netflix/, (msg) => {
    bot.sendMessage(msg.chat.id, getProductMessage('netflix'), { parse_mode: 'Markdown' });
});

bot.onText(/\/youtube/, (msg) => {
    bot.sendMessage(msg.chat.id, getProductMessage('youtube'), { parse_mode: 'Markdown' });
});

bot.onText(/\/prime/, (msg) => {
    bot.sendMessage(msg.chat.id, getProductMessage('prime'), { parse_mode: 'Markdown' });
});

bot.onText(/\/chaupal/, (msg) => {
    bot.sendMessage(msg.chat.id, getProductMessage('chaupal'), { parse_mode: 'Markdown' });
});

bot.onText(/\/capcut/, (msg) => {
    bot.sendMessage(msg.chat.id, getProductMessage('capcut'), { parse_mode: 'Markdown' });
});

// Sunday offers for individual products
bot.onText(/\/sunday_netflix/, (msg) => {
    bot.sendMessage(msg.chat.id, getProductMessage('netflix', true), { parse_mode: 'Markdown' });
});

bot.onText(/\/sunday_youtube/, (msg) => {
    bot.sendMessage(msg.chat.id, getProductMessage('youtube', true), { parse_mode: 'Markdown' });
});

bot.onText(/\/sunday_prime/, (msg) => {
    bot.sendMessage(msg.chat.id, getProductMessage('prime', true), { parse_mode: 'Markdown' });
});

bot.onText(/\/sunday_chaupal/, (msg) => {
    bot.sendMessage(msg.chat.id, getProductMessage('chaupal', true), { parse_mode: 'Markdown' });
});

bot.onText(/\/sunday_capcut/, (msg) => {
    bot.sendMessage(msg.chat.id, getProductMessage('capcut', true), { parse_mode: 'Markdown' });
});

// All products
bot.onText(/\/products/, (msg) => {
    const chatId = msg.chat.id;
    const isSun = isSunday();
    
    let productsMessage = `🛒 *All Products*`;
    
    if (isSun) {
        productsMessage += `\n🎁 *SUNDAY OFFERS ACTIVE! 20% OFF*`;
    }
    
    productsMessage += `\n\n`;
    
    for (const [key, product] of Object.entries(products)) {
        const price = isSun ? product.sunday_price : product.normal_price;
        productsMessage += `🎯 *${product.name}*\n💰 Price: ${price}\n📝 /${key}\n🎁 /sunday_${key}\n\n`;
    }
    
    productsMessage += `💡 *Why so cheap?* /whycheap\n🛍️ *Ready to buy?* Select a product and click Buy Now!`;
    
    bot.sendMessage(chatId, productsMessage, { parse_mode: 'Markdown' });
});

// Buy commands
bot.onText(/\/buy_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const productKey = match[1];
    const product = products[productKey];
    
    if (!product) {
        bot.sendMessage(chatId, "❌ Product not found. Please select from /products");
        return;
    }
    
    // Store user session
    userSessions[chatId] = { product: productKey, step: 'payment' };
    
    const isSun = isSunday();
    const price = isSun ? product.sunday_price : product.normal_price;
    
    const buyMessage = `
🛒 *Purchase: ${product.name}*

💰 *Price:* ${price}
${isSun ? '🎁 *Sunday Discount Applied!*' : ''}

📋 *Process:*
1. Complete payment via QR below
2. Upload payment screenshot
3. Get WhatsApp link for activation
4. We activate within 15-30 minutes

💳 *Payment Details:*
UPI ID: \`${product.upi_id}\`
Amount: ${price}

*Scan QR code below:*
    `;
    
    // Send payment message
    await bot.sendMessage(chatId, buyMessage, { parse_mode: 'Markdown' });
    
    // Send QR code (use your actual QR image URL)
    try {
        await bot.sendPhoto(chatId, product.payment_qr, {
            caption: `📱 Scan this QR to pay ${price}\n\nAfter payment, click: /upload_payment`
        });
    } catch (error) {
        await bot.sendMessage(chatId, `📱 *Payment QR*\n\nUPI ID: \`${product.upi_id}\`\nAmount: ${price}\n\nAfter payment, click: /upload_payment`, { parse_mode: 'Markdown' });
    }
    
    // Send payment instructions
    const instructions = `
*Payment Instructions:*
1. Open any UPI app (GPay, PhonePe, Paytm)
2. Scan the QR code or enter UPI ID
3. Pay exact amount: ${price}
4. Take screenshot of "Payment Successful" screen
5. Click /upload_payment

⚠️ *Important:*
• Keep screenshot ready
• Payment must be from your registered UPI
• Do not share OTP with anyone
    `;
    
    setTimeout(() => {
        bot.sendMessage(chatId, instructions, { parse_mode: 'Markdown' });
    }, 1000);
});

// Upload payment proof
bot.onText(/\/upload_payment/, (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions[chatId];
    
    if (!session || session.step !== 'payment') {
        bot.sendMessage(chatId, "❌ Please select a product first using /buy_productname");
        return;
    }
    
    session.step = 'upload';
    
    const uploadMessage = `
📸 *Upload Payment Proof*

Please send the screenshot of:
• "Payment Successful" screen
• UPI transaction details
• Transaction ID visible

*How to upload:*
1. Click 📎 (Attachment icon)
2. Select "Photo"
3. Choose payment screenshot
4. Send it here

*After uploading, we'll verify and send WhatsApp link!*
    `;
    
    bot.sendMessage(chatId, uploadMessage, { parse_mode: 'Markdown' });
});

// Handle photo upload
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions[chatId];
    
    if (!session || session.step !== 'upload') {
        return;
    }
    
    const product = products[session.product];
    const whatsappNumber = process.env.WHATSAPP_NUMBER;
    
    // Create WhatsApp message
    const whatsappMessage = `Hello! I have purchased ${product.name} from TDS Telegram Bot. Payment completed. Transaction ID: ${Date.now()}. Please activate my subscription.`;
    const encodedMessage = encodeURIComponent(whatsappMessage);
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    // Generate order ID
    const orderId = `TDS${Date.now().toString().slice(-8)}`;
    
    const confirmationMessage = `
✅ *Payment Received!*

📦 *Order Details:*
• Product: ${product.name}
• Order ID: ${orderId}
• Date: ${new Date().toLocaleDateString('en-IN')}
• Status: Payment Verified

📱 *WhatsApp Support:*
[Click here to contact WhatsApp Support](${whatsappLink})

*Next Steps:*
1. Click the WhatsApp link above
2. Send the pre-filled message
3. Our team will activate within 15-30 minutes
4. You'll receive login credentials

🛡️ *Warranty:* 7-day replacement if any issue
⏰ *Support:* 24/7 on WhatsApp

*Thank you for shopping with TDS!*
    `;
    
    await bot.sendMessage(chatId, confirmationMessage, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    });
    
    // Send WhatsApp button
    const keyboard = {
        inline_keyboard: [[
            {
                text: "📱 Open WhatsApp for Activation",
                url: whatsappLink
            }
        ]]
    };
    
    await bot.sendMessage(chatId, "Click below to open WhatsApp:", {
        reply_markup: keyboard
    });
    
    // Reset session
    delete userSessions[chatId];
    
    // Notify admin (optional)
    if (process.env.ADMIN_CHAT_ID) {
        const adminMsg = `🛒 New Order!\nOrder ID: ${orderId}\nProduct: ${product.name}\nUser: @${msg.from.username || 'No username'}`;
        bot.sendMessage(process.env.ADMIN_CHAT_ID, adminMsg);
    }
});

// Handle text messages (FAQ)
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.toLowerCase() || '';
    
    // Skip commands
    if (text.startsWith('/')) return;
    
    // FAQ Responses
    const responses = {
        'hello': '👋 Hello! Welcome to The Diamond Store! How can I help you today?',
        'hi': '👋 Hi there! Looking for premium subscriptions at amazing prices?',
        'price': '💰 Check our prices:\n/products - View all products\n/sunday - Sunday offers\n\nOr ask for specific product!',
        'how to buy': '🛒 *Purchase Process:*\n1. Select product (e.g., /netflix)\n2. Click Buy Now option\n3. Pay via QR code\n4. Upload payment proof\n5. Get WhatsApp link for activation\n\nNeed help? /help',
        'real': '✅ *100% Legit & Trusted:*\n• 500+ satisfied customers\n• Instant WhatsApp support\n• Manual verification\n• 24/7 customer service\n• Genuine subscriptions only\n\nWe value trust above everything!',
        'refund': '🔄 *Refund Policy:*\nFull refund if:\n• Service not activated within 1 hour\n• Service stops working within 7 days\n• Wrong product delivered\n\nContact WhatsApp support.',
        'time': `⏰ *Current Time (IST):* ${moment().tz('Asia/Kolkata').format('hh:mm A, DD MMM YYYY')}\n\nSunday offers active: ${isSunday() ? 'YES 🎁' : 'NO ⏳'}`,
        'contact': `📞 *Contact Support:*\nWhatsApp: https://wa.me/${process.env.WHATSAPP_NUMBER}\n\n24/7 support available!`,
        'offer': `🎁 *Current Offers:*\n• Sunday: 20% OFF all products\n• Bulk orders: Extra discount\n• Referral: Get ₹50 credit\n\nCheck: /sunday for today's offers`
    };
    
    for (const [key, response] of Object.entries(responses)) {
        if (text.includes(key)) {
            bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            return;
        }
    }
    
    // If no match, show help
    if (text.length > 3) {
        bot.sendMessage(chatId, `🤖 I'm your TDS assistant! Try:\n• /products - View all\n• /help - Instructions\n• Or mention a product name\n\nI'm here to help you save on premium subscriptions!`);
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error);
});

// Start server
app.get('/', (req, res) => {
    res.send('TDS Telegram Bot is running!');
});

app.listen(PORT, () => {
    console.log(`🚀 TDS Bot running on port ${PORT}`);
    console.log(`🤖 Bot started successfully!`);
    console.log(`📅 Sunday check: ${isSunday() ? 'ACTIVE 🎁' : 'INACTIVE'}`);
});