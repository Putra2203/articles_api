const express = require('express');
const cors = require('cors');
const dbConnect = require('./db'); 
const articleRoutes = require('./routes/articleRoutes.js'); 

require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
dbConnect();

// Routes
app.use('/articles', articleRoutes);

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
