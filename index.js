const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "missedcallhqafrique2026";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const LEADS_WEBHOOK_URL = process.env.LEADS_WEBHOOK_URL;

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const processedMessages = new Set();
const userStates = new Map();

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

async function sendLeadEmail({ phone, requestType, message }) {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.log("EMAIL_USER or EMAIL_PASS missing. Email not sent.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: EMAIL_USER,
      to: "myezsteps@gmail.com",
      subject: "🚨 New Lead - Missed Call HQ Afrique",
      text: `
New Lead Received

Phone: ${phone}
Request Type: ${requestType}

Message:
${message}

Status: New
Assigned To: Mor

Date: ${new Date().toLocaleString()}
`
    });

    console.log("Lead email notification sent.");
  } catch (error) {
    console.error("Lead email notification failed:", error.response?.data || error.message);
  }
}
async function saveLead(phone, requestType, message) {
  if (!LEADS_WEBHOOK_URL) {
    console.log("LEADS_WEBHOOK_URL missing. Lead not saved.");
    return;
  }

  const lines = message
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  try {
    await axios.post(LEADS_WEBHOOK_URL, {
      date: new Date().toISOString(),
      phone,
      name: lines[0] || "",
      business: lines[1] || "",
      city: lines[2] || "",
      requestType,
      status: "New",
      assignedTo: "Mor"
    });

    console.log("Lead saved to Google Sheets.");

    sendLeadEmail({
      phone,
      requestType,
      message
    }).catch((error) => {
      console.error("Lead email notification failed:", error.response?.data || error.message);
    });
  } catch (error) {
    console.error("Lead save failed:", error.response?.data || error.message);
  }
}

async function sendReply(to, replyText) {
  return axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
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
}

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
    const cleanText = incomingText.trim().toLowerCase();

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

    let replyText;
    const currentState = userStates.get(from);

    if (currentState === "waiting_for_demo_info") {
      console.log("Demo lead received:", incomingText);
      await saveLead(from, "Démonstration", incomingText);

      userStates.delete(from);

      replyText = `Merci. Vos informations ont bien été reçues.

Notre équipe vous contactera pour organiser une démonstration, In Sha Allah.`;
    } else if (currentState === "waiting_for_pricing_info") {
      console.log("Pricing lead received:", incomingText);
      await saveLead(from, "Tarifs", incomingText);

      userStates.delete(from);

      replyText = `Merci. Vos informations ont bien été reçues.

Nous vous enverrons nos tarifs adaptés à vos besoins, In Sha Allah.`;
    } else if (currentState === "waiting_for_callback_info") {
      console.log("Callback request received:", incomingText);
      await saveLead(from, "Être rappelé", incomingText);

      userStates.delete(from);

      replyText = `Merci. Vos informations ont bien été reçues.

Notre équipe vous rappellera dès que possible, In Sha Allah.`;
    } else if (cleanText === "1") {
      userStates.set(from, "waiting_for_demo_info");

      replyText = `Merci pour votre intérêt.

Veuillez nous indiquer :

• Votre nom
• Le nom de votre entreprise
• Votre ville

Nous vous contacterons pour organiser une démonstration, In Sha Allah.`;
    } else if (cleanText === "2") {
      userStates.set(from, "waiting_for_pricing_info");

      replyText = `Merci pour votre intérêt.

Veuillez nous indiquer :

• Votre nom
• Le nom de votre entreprise
• Votre ville

Nous vous enverrons nos tarifs adaptés à vos besoins, In Sha Allah.`;
    } else if (cleanText === "3") {
      userStates.set(from, "waiting_for_callback_info");

      replyText = `Merci.

Veuillez nous communiquer :

• Votre nom
• Votre numéro de téléphone
• Le meilleur moment pour vous joindre

Nous vous rappellerons bientôt, In Sha Allah.`;
    } else {
      replyText = `Bonjour 👋

Bienvenue chez Missed Call HQ Afrique.

Nous aidons les entreprises à ne plus perdre de clients lorsqu’un appel est manqué.

Comment pouvons-nous vous aider aujourd’hui ?

1️⃣ Demander une démonstration

2️⃣ Obtenir nos tarifs

3️⃣ Être rappelé

Répondez simplement par 1, 2 ou 3.

Nous vous répondrons dans les plus brefs délais, In Sha Allah.`;
    }

    const response = await sendReply(from, replyText);
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
