import express from "express";
import pkg from "twilio";
const { Twilio, validateRequest } = pkg;
import { GoogleGenerativeAI } from "@google/generative-ai";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(
  bodyParser.urlencoded({
    extended: false,
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const client = new Twilio(accountSid, authToken);
const port = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

async function getAIResponse(message) {
  const prompt = `
  You are "ShoSure", a helpful and friendly fact-checking chatbot on WhatsApp for Nigerian users. You speak in a natural, conversational style, often using Nigerian Pidgin and English, you can also use yoruba, igbo, Hausa, and other Nigerian languages based on what the user wants. Your goal is to caution users about potential misinformation without being harsh.

  A user has sent you this message: "${message}"

  If this message looks like a common rumor, scam, or unverified news (e.g., about money, health, politics, school fees, fuel prices, etc.), please provide a helpful and factual response. Be concise and witty if possible.

  If the message is just a greeting (like 'hi', 'hello') or small talk, respond warmly as a bot would.
  If the message is not a rumor, or if you are not sure, politely say you are not sure and encourage them to check official sources.

  Remember to keep your response short enough for a WhatsApp message.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Abeg, my brain no dey work well now. Try again small time. 🙏";
  }
}

const factDatabase = {
  "school fee": {
    response:
      "ShoSure say: 🚨 That fee increase rumor na lie! School don confirm say no increase for this term. Official announcement dey come next week. Confidence: High. Source: Official School Bulletin.",
    keywords: ["school fee", "fee increase", "school bill"],
  },
  "fuel price": {
    response:
      "ShoSure say: 🔥 Na old message! NNPC don confirm say no fuel scarcity dey for tomorrow. Confidence: High. Source: NNPC Official Twitter.",
    keywords: ["fuel price", "fuel scarcity", "fuel", "nnpc"],
  },
  default: {
    response:
      "ShoSure here! I dey for beta. I no too sure about this one yet o! 🙏 No forget to check from official sources before you share. You fit send another rumor make I try?",
  },
};

const cleanForwardedMessage = (rawMessage) => {
  return rawMessage
    .replace(/forwarded:/i, "")
    .replace(/‎/, "") // Removes a common hidden character
    .replace(/from\s+.*?:/i, "")
    .trim();
};

const findFactCheck = (message) => {
  const cleanMessage = message.toLowerCase();
  for (const [key, fact] of Object.entries(factDatabase)) {
    if (key === "default") continue;
    // Check if any keyword for this fact is in the message
    if (fact.keywords.some((keyword) => cleanMessage.includes(keyword))) {
      return fact.response;
    }
  }
  return factDatabase.default.response;
};

app.post("/incoming", async (req, res) => {
  const twilioSignature = req.headers["x-twilio-signature"];
  const url = "https://shosure.onrender.com/incoming";
  const params = req.body;

  if (!validateRequest(authToken, twilioSignature, url, params)) {
    console.error("Request validation failed - potentially not from Twilio");
    return res.status(403).send("Forbidden");
  }

  const rawMessage = req.body.Body;
  const fromNumber = req.body.From;

  const cleanedMessage = cleanForwardedMessage(rawMessage);
  console.log(`Original: "${rawMessage}" -> Cleaned: "${cleanedMessage}"`);

  let responseBody;
  if (cleanedMessage.toLowerCase().includes("!quiz")) {
    responseBody =
      "Here’s a quick quiz: Wetin be the capital of Nigeria? Reply with A. Lagos, B. Abuja, or C. Port Harcourt.";
  } else if (cleanedMessage.toLowerCase().includes("!proverb")) {
    responseBody =
      "Ẹni bá mọ ọrọ̀ tó ń lọ, kò ní pa àparò pẹ́. (He who knows what is happening will not kill a partridge in vain.)";
  } else {
    responseBody = await getAIResponse(cleanedMessage);
  }

  client.messages
    .create({
      body: responseBody,
      from: `whatsapp:${twilioPhone}`,
      to: fromNumber,
    })
    .then(() => {
      res.set("Content-Type", "text/xml");
      res.send("<Response></Response>");
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send(err);
    });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
