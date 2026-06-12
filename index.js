const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "missedcallhqafrique2026";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const processedMessages = new Set();

app.get("/", (req, res) => {
  res.send("Missed Call HQ Afrique Bot is running.");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  console.log("Incoming WhatsApp webhook:", JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const messageId = message.id;
    const from = message.from;
    const incomingText = message.text?.body || "";

    console.log("MESSAGE ID:", messageId);
    console.log("Message received from:", from);
    console.log("Message body:", incomingText);

    if (processedMessages.has(messageId)) {
      console.log("Duplicate message ignored:", messageId);
      return res.sendStatus(200);
    }

    processedMessages.add(messageId);

    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      console.error("Missing WHATSAPP_TOKEN or PHONE_NUMBER_ID");
      return res.sendStatus(200);
    }

    const replyText = `Bonjour 👋

Bienvenue chez Missed Call HQ Afrique.

Nous aidons les entreprises à ne plus perdre de clients lorsqu’un appel est manqué.

Comment pouvons-nous vous aider aujourd’hui ?

1️⃣ Demander une démonstration

2️⃣ Obtenir nos tarifs

3️⃣ Être rappelé

Répondez simplement par 1, 2 ou 3.

Nous vous répondrons dans les plus brefs délais, In Sha Allah.`;

    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: {
          body: replyText
        }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Reply sent:", JSON.stringify(response.data, null, 2));
    return res.sendStatus(200);
  } catch (error) {
    console.error("Error sending WhatsApp reply:", error.response?.data || error.message);
    return res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
