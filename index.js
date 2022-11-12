import express from "express";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import cors from "cors";
import dayjs from "dayjs";
import joi from "joi";

const app = express();

dotenv.config();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient
  .connect()
  .then(() => {
    console.log("MongoDB connected");
    db = mongoClient.db("uol");
  })
  .catch((err) => {
    console.log(err);
  });

const userSchema = joi.object({
  name: joi.string().required(),
  lastStatus: joi.number().required,
});

const messageSchema = joi.object({
  from: joi.string().required,
  to: joi.string().required,
  text: joi.string().required,
  type: joi.string().valid("message", "private_message").required(),
  time: joi.string().required,
});

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  try {
    const userAlredyExists = await db
      .collection("users")
      .findOne({ name: name });

    if (userAlredyExists) {
      res.sendStatus(409);
      return;
    }

    const user = {
      name,
      lastStatus: Date.now(),
    };

    const validation = userSchema.validate(user, { abortEarly: false });

    if (validation.error) {
      const erros = validation.error.details.map((d) => d.message);
      res.status(422).send(erros);
      return;
    }

    const loginMessage = {
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs(participants.lastStatus).format("HH:mm:ss"),
    };

    await db.collection("users").insertOne(user);
    await db.collection("messages").insertOne(loginMessage);
    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participantsList = db.collection("users");

    const participants = await participantsList.find().toArray();
    res.send(participants);
  } catch (err) {
    res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  try {
    const { to, text, type } = req.body;
    const user = req.headers.user;
    const userExists = await db.collection("messages").findOne({ from: user });
    if (!userExists) {
      res.status(422).send("erro na verific se usuário existe");
      return;
    }

    const newMessage = {
      from: userExists.name,
      to,
      text,
      type,
      time: dayjs(Date.now()).format("HH:mm:ss"),
    };

    const validation = messageSchema.validate(newMessage, {
      abortEarly: false,
    });

    if (validation.error) {
      const erros = validation.error.details.map((d) => d.message);
      res.status(422).send(erros);
      return;
    }

    await db.collection("messages").insertOne(newMessage);
    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server runnin in port: ${process.env.PORT}`);
});
