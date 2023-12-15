const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Place = require("./models/Place");
const Booking = require("./models/Booking");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const imageDownloader = require("image-downloader");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();
const app = express();
const PORT = 3000;

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "Akashthegreat";

const corsOptions = {
  origin: "http://localhost:5173", // Allow only http://localhost:5173 to access
  credentials: true, // Allow cookies
};

app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
mongoose.connect(process.env.MONGO_URL);

app.get("/", (req, res) => {
  return res.json("Hey surver is running");
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const user = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    return res.json(user);
  } catch (error) {
    return res.status(422).json(error);
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      let passCheck = bcrypt.compareSync(password, user.password);
      if (passCheck) {
        const authToken = jwt.sign(
          { email: user.email, id: user._id },
          jwtSecret
        );
        return res.cookie("token", authToken).json(user);
      } else {
        return res.status(422).json({ error: "Invalid password" });
      }
    } else return res.status(422).json({ error: "User not found" });
  } catch (error) {
    return res.status(422).json(error);
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, async (err, user) => {
      if (err) throw err;
      const { name, email, _id } = await User.findById(user.id);
      res.json({ name, email, _id });
    });
  } else res.json(null);
});

app.post("/logout", (req, res) => {
  res.clearCookie("token").json({ message: "Logged out successfully" });
});

app.post("/upload-by-link", async (req, res) => {
  const { link } = req.body;
  const newName = Date.now() + ".jpg";
  await imageDownloader.image({
    url: link,
    dest: __dirname + "/uploads/" + newName,
    options: {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.200 Safari/537.3",
      },
    },
  });
  res.json(newName);
});

const photosMiddleware = multer({ dest: "uploads/" });
app.post("/upload", photosMiddleware.array("photos", 100), async (req, res) => {
  const uploadedFiles = [];
  for (let i = 0; i < req.files.length; i++) {
    const { path, originalname } = req.files[i];
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);
    uploadedFiles.push(newPath.replace("uploads\\", ""));
  }
  return res.json(uploadedFiles);
});

app.post("/places", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    const {
      title,
      description,
      addedphotos,
      address,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
    } = req.body;
    jwt.verify(token, jwtSecret, async (err, user) => {
      if (err) throw err;
      const placeDoc = await Place.create({
        owner: user.id,
        title,
        description,
        photos: addedphotos,
        address,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      res.json(placeDoc);
    });
  } else res.json(null);
});

app.put("/places", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    const {
      id,
      title,
      description,
      addedphotos,
      address,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
    } = req.body;
    jwt.verify(token, jwtSecret, async (err, user) => {
      if (err) throw err;
      let placeDoc = await Place.findById(id);
      if (placeDoc.owner.toString() === user.id) {
        placeDoc.set({
          title,
          description,
          photos: addedphotos,
          address,
          perks,
          extraInfo,
          checkIn,
          checkOut,
          maxGuests,
          price,
        });
        placeDoc.save();
        res.json(placeDoc);
      }
    });
  } else res.json(null);
});

app.get("/places", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, async (err, user) => {
      if (err) throw err;
      const places = await Place.find({ owner: user.id });
      res.json(places);
    });
  } else res.json(null);
});

app.get("/places/:id", async (req, res) => {
  const { id } = req.params;
  const place = await Place.findById(id);
  res.json(place);
});

app.get("/allplaces", async (req, res) => {
  const places = await Place.find();
  res.json(places);
});

app.post('/bookings', async(req, res)=>{
  const userData = await getUserDataFromReq(req);
  const {place, checkIn, checkOut, numberOfGuests, name, phone, price} = req.body;
  Booking.create({place, checkIn, checkOut, numberOfGuests, name, phone, price, user:userData.id}).then((doc)=>{
    res.json(doc);
  }).catch((err)=>{
    throw err;
  });
})

app.get('/bookings', async(req, res)=>{
  const userData = await getUserDataFromReq(req);
  const bookings = await Booking.find({user:userData.id});
  res.json(bookings);
})

function getUserDataFromReq(req){
  return new Promise((resolve, reject)=>{
    const {token} = req.cookies;
    if (token) {
      jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) reject(err);
        resolve(userData);
      });
    }else res.json(null);
  });
}

app.listen(PORT, (error) => {
  if (!error) console.log("Server is Successfully Running on port " + PORT);
  else console.log("Error occurred, server can't start", error);
});
