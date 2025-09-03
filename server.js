import express from "express";
import pkg from "twilio";
const { Twilio } = pkg;
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;
const client = new Twilio(accountSid, authToken);
const port = process.env.PORT || 3000;

app.post("/incoming", (req, res) => {
  const message = req.body.Body.toLowerCase();
  let response = "";

  if (message.includes("rumor")) {
    response = "ShoSure says: Are you sure about that? Let’s check the facts!";
  } else if (message.includes("quiz")) {
    response = "Here’s a quick quiz: What’s the capital of Nigeria?";
  } else {
    response = "ShoSure here! How can I help you today?";
  }

  client.messages
    .create({
      body: response,
      from: "whatsapp:+14155238886",
      to: `whatsapp:${req.body.From}`,
    })
    .then(() => res.send("Message sent!"))
    .catch((err) => res.status(500).send(err));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
