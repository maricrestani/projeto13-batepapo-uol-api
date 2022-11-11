import express from "express";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import core from "cors";

const app = express();
const mongoClient = new MongoClient(process.env.MONGO_URI);
dotenv.config();
app.use(express.json());
app.use(cors());

let db = mongoClient.db("uol");

try {
  await mongoClient.conect();
  console.log("MongoDB connected");
} catch (err) {
  console.log(err);
}

app.listen(process.env.PORT, () => {
  console.log(`Server runnin in port: ${process.env.PORT}`);
});
