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
  try {
    const { name } = req.body;
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
    const { user } = req.headers;
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

app.get("/messages", async (req, res) => {
  try {
    const messages = await db.collection("messages").find().toArray();
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
  try {
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
  } catch (error) {
    res.status(500).send(error);
  }
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
