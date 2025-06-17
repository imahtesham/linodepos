// Import the express library
const express = require('express');

// Create an instance of an express application
const app = express();
const port = 3000; // The port the server will listen on

// Define a "route" for the homepage
app.get('/', (req, res) => {
  res.send('Hello, World! Your POS application is running.');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});