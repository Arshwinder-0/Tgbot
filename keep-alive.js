// Keep Render service awake
const https = require('https');

function pingSelf() {
    try {
        https.get('https://tds-bot.onrender.com', (res) => {
            console.log(`✅ Pinged: ${res.statusCode} - ${new Date().toLocaleTimeString()}`);
        }).on('error', (err) => {
            console.log('❌ Ping error:', err.message);
        });
    } catch (e) {
        console.log('❌ Ping exception:', e.message);
    }
}

// Ping every 14 minutes (Render sleeps after 15)
console.log('🔄 Keep-alive started...');
pingSelf(); // Initial ping
setInterval(pingSelf, 14 * 60 * 1000); // Every 14 minutes