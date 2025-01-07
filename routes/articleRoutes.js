const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

router.get("/news", async (req, res) => {
  try {
    const { category, page } = req.query;
    const limit = 8;
    const skip = page ? (parseInt(page) - 1) * limit : 0;

    const database = client.db("articledb");
    const collection = database.collection("article");

    let query = {};
    if (category) {
      query = { category: { $regex: category, $options: "i" } };
    }

    const articles = await collection
      .find(query)
      .limit(limit)
      .skip(skip)
      .toArray();

    res.json({
      news: articles, // Data artikel
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching news");
  }
});

const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");

router.post("/api/register", async (req, res) => {
  try {
    const {name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const database = client.db("articledb");
    const usersCollection = database.collection("users");

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      name,
      email,
      password: hashedPassword,
      createdAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    res.status(201).json({
      message: "User registered successfully",
      userId: result.insertedId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error registering user");
  }
});

const jwt = require("jsonwebtoken");

router.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const database = client.db("articledb");
    const usersCollection = database.collection("users");

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      "9d7ecf760a5586d8869944a4cb4a93c677307f8503e2290136305f7fe8f80c191b10f25f725b30f1c403731d8318c4feec96e83cfcfdb1337a3b9d52f3dd1f74", 
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      token, 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error logging in user");
  }
});

router.post("/news", async (req, res) => {
  try {
    const { title, summary, content, category, date, image, source, url } =
      req.body;

    if (
      !title ||
      !summary ||
      !content ||
      !category ||
      !date ||
      !image ||
      !source ||
      !url
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const imageDirectory = path.join(__dirname, "images");
    if (!fs.existsSync(imageDirectory)) fs.mkdirSync(imageDirectory);

    const imageName = `${Date.now()}-${path.basename(image)}`;
    const imagePath = path.join(imageDirectory, imageName);

    const downloadImage = async () => {
      const response = await axios({
        method: "get",
        url: image,
        responseType: "stream",
      });

      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(imagePath);
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
    };

    await downloadImage();

    const database = client.db("articledb");
    const collection = database.collection("article");

    const newArticle = {
      title,
      summary,
      content,
      category,
      date: new Date(date),
      image: `/images/${imageName}`, 
      source,
      url,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(newArticle);

    res.status(201).json({
      message: "Article created successfully",
      articleId: result.insertedId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating article");
  }
});

router.put("/news/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, summary, content, category, date, image, source, url } =
      req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid article ID" });
    }

    const database = client.db("articledb");
    const collection = database.collection("article");

    const existingArticle = await collection.findOne({ _id: new ObjectId(id) });
    if (!existingArticle) {
      return res.status(404).json({ message: "Article not found" });
    }

    let updatedFields = {
      title,
      summary,
      content,
      category,
      date: new Date(date),
      source,
      url,
    };

    if (image) {
      const imageDirectory = path.join(__dirname, "images");
      const imageName = `${Date.now()}-${path.basename(image)}`;
      const imagePath = path.join(imageDirectory, imageName);

      const downloadImage = async () => {
        const response = await axios({
          method: "get",
          url: image,
          responseType: "stream",
        });

        return new Promise((resolve, reject) => {
          const writer = fs.createWriteStream(imagePath);
          response.data.pipe(writer);
          writer.on("finish", resolve);
          writer.on("error", reject);
        });
      };

      await downloadImage();

      if (existingArticle.image) {
        const oldImagePath = path.join(__dirname, existingArticle.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      updatedFields.image = `/images/${imageName}`;
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    res.json({ message: "Article updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating article");
  }
});

router.delete("/news/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid article ID" });
    }

    const database = client.db("articledb");
    const collection = database.collection("article");

    const article = await collection.findOne({ _id: new ObjectId(id) });
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    if (article.image) {
      const imagePath = path.join(__dirname, article.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Article not found" });
    }

    res.json({ message: "Article deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting article");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const database = client.db("articledb");
    const collection = database.collection("article");

    const ObjectId = require("mongodb").ObjectId;
    const article = await collection.findOne({ _id: new ObjectId(id) });

    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    res.json(article);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching article by ID");
  }
});

router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

    const database = client.db("articledb");
    const collection = database.collection("article");

    const results = await collection
      .find({
        $or: [
          { title: { $regex: q, $options: "i" } }, 
          { content: { $regex: q, $options: "i" } }, 
        ],
      })
      .toArray();

    res.json({ news: results });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching search results");
  }
});

module.exports = router;
