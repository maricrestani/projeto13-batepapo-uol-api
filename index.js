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

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    res.status(422).send({ error: "name deve ser strings não vazio" });
    return;
  }

  const loginMessage = {
    from: name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: dayjs(participants.lastStatus).format("HH:mm:ss"),
  };

  await db.collection("users").insertOne({ name, lastStatus: Date.now() });
  await db.collection("messages").insertOne(loginMessage);
  res.sendStatus(201);
});

app.listen(process.env.PORT, () => {
  console.log(`Server runnin in port: ${process.env.PORT}`);
});
