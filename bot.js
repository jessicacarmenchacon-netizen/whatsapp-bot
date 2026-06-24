const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const fs = require("fs");

const NUMERO = "51989235888";

async function startBot() {

    const { state, saveCreds } =
        await useMultiFileAuthState("auth");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 2000
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect, isNewLogin }) => {

        if (qr) {
            console.log("📱 Generando pairing code...");
            try {
                const code = await sock.requestPairingCode(NUMERO);
                console.log(`\n🔑 TU CÓDIGO DE VINCULACIÓN: ${code}\n`);
                console.log("Ve a WhatsApp → Dispositivos vinculados → Vincular con número de teléfono");
                console.log("Ingresa el código de 8 dígitos que aparece arriba\n");
            } catch (err) {
                console.error("❌ Error generando pairing code:", err.message);
            }
        }

        if (connection === "open") {
            console.log("✅ BOT CONECTADO Y ACTIVO EN LA NUBE");
        }

        if (connection === "close") {

            const codigo = lastDisconnect?.error?.output?.statusCode;
            const razon = lastDisconnect?.error?.message || "desconocida";

            console.log(`⚠️ Conexión cerrada. Razón: ${razon} (código: ${codigo})`);

            if (codigo === DisconnectReason.loggedOut || codigo === 401) {
                console.log("❌ Sesión expirada. Borrando auth y reconectando...");
                fs.rmSync("auth", { recursive: true, force: true });
                setTimeout(() => startBot(), 3000);
            } else {
                const delay = codigo === 515 ? 3000 : 5000;
                console.log(`🔄 Reconectando en ${delay / 1000}s...`);
                setTimeout(() => startBot(), delay);
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {

        try {

            const msg = messages[0];

            if (!msg.message) return;

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                "";

            const chatId = msg.key.remoteJid;

            if (text.trim().toLowerCase() === "/rally") {

                const metadata = await sock.groupMetadata(chatId);

                const usuarioQueEjecuto = msg.key.participant;
                const miId = sock.user.id;

                const mentions = [];
                let listaGranjas = "";

                metadata.participants.forEach((p) => {
                    if (p.id === usuarioQueEjecuto) return;
                    if (p.id === miId) return;

                    const numero = p.id.split("@")[0];
                    listaGranjas += `▫️ @${numero}\n`;
                    mentions.push(p.id);
                });

                const mensaje =
`⚔️🚨 RALLY 🚨⚔️

‼️ AL ATAQUE GRANJAS ‼️

😱 LAS GRANJAS:

${listaGranjas}
💪 ¡Que no los quemen!

━━━━━━━━━━━━━━━

💎 Gemas
🏰 RSS
🤖 Botfarm Premium

📲 WhatsApp: +51 989235888
👑 WANG LIN`;

                await sock.sendMessage(
                    chatId,
                    {
                        text: mensaje,
                        mentions: mentions
                    }
                );
            }

        } catch (err) {
            console.error("❌ Error al procesar mensaje:", err.message);
        }
    });
}

startBot();