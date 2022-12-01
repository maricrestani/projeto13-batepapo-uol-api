import express from "express";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
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
  const userExists = await db
    .collection("messages")
    .findOne({ from: req.body.name });

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
    from: req.body.name,
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
  const participants = await db.collection("users").find({}).toArray();
  res.send(participants);

  res.sendStatus(500);
});

app.post("/messages", async (req, res) => {
  const { user } = req.headers;

  const userExists = await db.collection("messages").findOne({ from: user });
  if (!userExists) {
    res.sendStatus(422);
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
  const { user } = req.headers;
  const limit = parseInt(req.query.limit);
  const allMessages = await db.collection("messages").find({}).toArray();
  const messages = [];

  for (let i = 0; i < allMessages.length; i++) {
    let item = allMessages[i];
    if (item.to === "Todos" || item.to === user || item.from === user) {
      messages.push(item);
    }
  }

  if (limit) {
    const limitedMessages = messages.filter((message, index) => index < limit);
    res.send(limitedMessages);
    return;
  }

  res.send(messages);
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

app.delete("/messages/:id", async (req, res) => {
  const user = req.headers.user;
  const paramsId = req.params.id;

  const message = await db
    .collection("messages")
    .findOne({ _id: ObjectId(paramsId) });

  if (!message) {
    res.sendStatus(404);
    return;
  }
  if (message.from !== user) {
    res.sendStatus(401);
    return;
  }

  db.collection("messages").deleteOne({ _id: ObjectId(paramsId) });
  res.status(200).send({ message: "Documento apagado com sucesso!" });
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
