const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");
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

    // Kirim data dalam format yang cocok dengan frontend
    res.json({
      news: articles, // Data artikel
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching news");
  }
});

// Endpoint: artikel berdasarkan ID
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

    // Query untuk mencari artikel berdasarkan judul atau konten
    const results = await collection
      .find({
        $or: [
          { title: { $regex: q, $options: "i" } }, // Cari berdasarkan judul
          { content: { $regex: q, $options: "i" } }, // Cari berdasarkan konten
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
