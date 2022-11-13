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
  name: joi.string().min(1).required(),
});

const messageSchema = joi.object({
  to: joi.string().min(1).required(),
  text: joi.string().min(1).required(),
  type: joi.string().valid("message", "private_message").required(),
});

app.post("/participants", async (req, res) => {
  const { user } = req.body;
  const userExists = await db.collection("messages").findOne({ from: user });

  if (userExists) {
    res.status(409).send("Usuário já existe");
    return;
  }

  const validation = userSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    const erros = validation.error.details.map((d) => d.message);
    res.status(422).send(erros);
    return;
  }

  const loginMessage = {
    from: user,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: dayjs().format("HH:mm:ss"),
  };

  db.collection("users").insertOne({ ...req.body, lastStatus: Date.now() });
  db.collection("messages").insertOne(loginMessage);
  res.sendStatus(201);
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("users").find({}).toArray();
    res.send(participants);
  } catch (err) {
    res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  const { user } = req.headers;

  const userExists = await db.collection("messages").findOne({ from: user });
  if (!userExists) {
    res.status(422).send("erro na verific se usuário existe");
    return;
  }

  const newMessage = {
    ...req.body,
    from: user,
    time: dayjs(Date.now()).format("HH:mm:ss"),
  };

  const validation = messageSchema.validate(req.body, {
    abortEarly: false,
  });

  if (validation.error) {
    const erros = validation.error.details.map((d) => d.message);
    res.status(422).send(erros);
    return;
  }

  await db.collection("messages").insertOne(newMessage);
  res.sendStatus(201);
});

app.get("/messages", async (req, res) => {
  try {
    const messages = await db.collection("messages").find({}).toArray();
    const limit = parseInt(req.query.limit);

    if (limit) {
      const limitedMessages = messages.filter(
        (message, index) => index < limit
      );
      res.send(limitedMessages);
      return;
    }

    res.send(messages);
  } catch (err) {
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  const userExists = await db.collection("messages").findOne({ from: user });
  if (!userExists) {
    res.sendStatus(404);
    return;
  }

  await db.collection("messages").updateOne(
    {
      user: user,
    },
    { $set: { lastStatus: Date.now() } }
  );

  res.sendStatus(200);
});

async function removeInactiveUsers() {
  const users = await db.collection("users").find({}).toArray();
  users.map((user) => {
    if (
      dayjs().format("HHmmss") - dayjs(user.lastStatus).format("HHmmss") >
      10
    ) {
      db.collection("users").deleteOne({ _id: user._id });

      db.collection("messages").insertOne({
        from: user.name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs().format("HH:MM:ss"),
      });
    }
  });
}

setInterval(removeInactiveUsers, 15000);

app.listen(process.env.PORT, () => {
  console.log(`Server runnin in port: ${process.env.PORT}`);
});
