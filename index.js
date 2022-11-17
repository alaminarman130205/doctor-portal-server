const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
// middle ware

app.use(cors());
app.use(express.json());

// mongodb connection list

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vycotd7.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// crud operation running here

async function run() {
  try {
    const appointmentOptionCollection = client
      .db("doctorPortal")
      .collection("ApointmentOption");

    app.get("/appointmentsOptions", async (req, res) => {
      const query = {};
      const options = await appointmentOptionCollection.find(query).toArray();
      res.send(options);
    });
  } finally {
  }
}
run().catch(console.log);

//mongodb connection list end

app.get("/", async (req, res) => {
  res.send("doctors portal server is running");
});

app.listen(port, () => console.log(`doctors portal running on port ${port}`));
