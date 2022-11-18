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
    const bookingCollection = client.db("doctorPortal").collection("bookings");

    //fetching data from mongobd

    app.get("/appointmentsOptions", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const options = await appointmentOptionCollection.find(query).toArray();

      // get the bookings of the provided date
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingCollection
        .find(bookingQuery)
        .toArray();

      // code carefully :D
      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        const bookedSlots = optionBooked.map((book) => book.slot);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        console.log(date, option.name, bookedSlots, remainingSlots.length);
        option.slots = remainingSlots;
      });
      res.send(options);
    });
    /*
    *api naming convention
    app.get('/bookings') all bookings info fetch by this name convention
    app.get('/bookings/:id') single id fetch by this name convention
    app.post('/bookings') single bookings info post 
    app.patch('/bookings/:id') update one info by this convention
    app.delete('/bookings:id/:id')delete one info from this convention

    */

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
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
