// --- Imports and Configuration ---

// Load environment variables from .env file
require('dotenv').config(); 

// Import required libraries
const express = require('express');
const { Pool } = require('pg'); // PostgreSQL client

// --- Database Connection Setup ---

// Create a new Pool instance to manage connections to the database
// The configuration is read from the .env file for security
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// --- Express Application Setup ---

const app = express(); // Create an instance of the express application
const port = 3000;     // Define the port the server will run on

// Middleware to automatically parse incoming JSON request bodies
// This lets us read `req.body` in our POST/PUT endpoints
app.use(express.json());


// --- API Routes (The Core of our Application) ---

/**
 * @route   GET /
 * @desc    A simple root route to check if the API is alive.
 * @access  Public
 */
app.get('/', (req, res) => {
  res.status(200).send('POS API is running and ready to serve requests!');
});

/**
 * @route   POST /business-units
 * @desc    Creates a new business unit (Group, Company, or Branch).
 * @access  Private (to be secured later)
 */
app.post('/business-units', async (req, res) => {
  // Extract data from the incoming request's body
  // Set parent_id to null by default if it's not provided
  const { name, type, parent_id = null } = req.body;

  // Basic validation to ensure required fields are present
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required fields.' });
  }

  try {
    // The SQL query to insert a new row into the table.
    // We use parameterized queries ($1, $2, $3) to prevent SQL injection attacks.
    const query = `
      INSERT INTO business_units (name, type, parent_id)
      VALUES ($1, $2, $3)
      RETURNING *; 
    `; // 'RETURNING *' sends back the newly created row.
    
    const values = [name, type, parent_id];
    
    // Execute the query using our connection pool
    const result = await pool.query(query, values);

    // If successful, send a 201 "Created" status and the new business unit object
    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error executing query to create business unit:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});


/**
 * @route   GET /business-units
 * @desc    Retrieves a list of all business units.
 * @access  Private (to be secured later)
 */
app.get('/business-units', async (req, res) => {
  try {
    // A simple query to select all records, ordered by their ID for consistency
    const query = 'SELECT * FROM business_units ORDER BY id ASC;';
    
    // Execute the query
    const result = await pool.query(query);

    // Send a 200 "OK" status and the array of business units
    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Error executing query to fetch business units:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});


// --- Start the Server ---

// Make the application listen on the specified port
app.listen(port, () => {
  console.log(`Server is successfully listening on port ${port}`);
});