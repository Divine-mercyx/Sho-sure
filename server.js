import express from "express";
import pkg from "twilio";
const { Twilio, validateRequest } = pkg;
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

app.post("/incoming", (req, res) => {
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
    responseBody = findFactCheck(cleanedMessage);
  }

  client.messages
    .create({
      body: responseBody,
      from: twilioPhone,
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
