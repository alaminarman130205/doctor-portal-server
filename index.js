const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
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

function varifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(403).send("unauthorized access ");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {
    if (error) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

// crud operation running here

async function run() {
  try {
    const appointmentOptionCollection = client
      .db("doctorPortal")
      .collection("ApointmentOption");
    const bookingCollection = client.db("doctorPortal").collection("bookings");
    const usersCollection = client.db("doctorPortal").collection("users");
    const doctorCollection = client.db("doctorPortal").collection("doctors");
    const paymentCollection = client.db("doctorPortal").collection("payments");

    const varifyAdmin = async (req, res, next) => {
      const decodeEmail = req.decoded.email;
      const query = { email: decodeEmail };
      const user = await usersCollection.findOne(query);
      if (user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

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
        option.slots = remainingSlots;
      });
      res.send(options);
    });

    app.get("/appointmentSpecialty", async (req, res) => {
      const query = {};
      const result = await appointmentOptionCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
    });

    // for any api update or website problem let's do some extra code
    //aggregate is not working

    /*
    *api naming convention
    app.get('/bookings') all bookings info fetch by this name convention
    app.get('/bookings/:id') single id fetch by this name convention
    app.post('/bookings') single bookings info post 
    app.patch('/bookings/:id') update one info by this convention
    app.delete('/bookings:id/:id')delete one info from this convention

    */
    app.get("/bookings", varifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (email != decodedEmail) {
        return res.status(403).send({ message: " forbidden access " });
      }

      const query = { email: email };
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;

      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment,
      };
      const alredyBooked = await bookingCollection.find(query).toArray();
      if (alredyBooked.length) {
        const message = `you already have a booking  on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }

      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingCollection.findOne(query);
      res.send(booking);
    });

    //payment api

    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      const _id = payment.bookingId;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updateResult = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "24h",
        });
        return res.send({ accesstoken: token });
      }
      res.status(403).send({ accesstoken: "" });
    });

    //all users api
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    app.put("/users/admin/:id", varifyJWT, varifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // app.get("/addPrice", async (req, res) => {
    //   const filter = {};
    //   const options = { upsert: true };
    //   const updatedDoc = {
    //     $set: {
    //       price: 99,
    //     },
    //   };
    //   const result = await appointmentOptionCollection.updateMany(
    //     filter,
    //     updatedDoc,
    //     options
    //   );
    //   res.send(result);
    // });

    app.post("/doctors", varifyJWT, varifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    app.get("/doctors", varifyJWT, varifyAdmin, async (req, res) => {
      const query = {};
      const doctors = await doctorCollection.find(query).toArray();
      res.send(doctors);
    });

    app.delete("/doctors/:id", varifyJWT, varifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await doctorCollection.deleteOne(filter);
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
