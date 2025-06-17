// --- Imports and Configuration ---

// Load environment variables from .env file
require('dotenv').config(); 

// Import required libraries
const express = require('express');
const { Pool } = require('pg'); // PostgreSQL client
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For JSON Web Tokens

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
 * @route   POST /api/business-units
 * @desc    Creates a new business unit (Group, Company, or Branch).
 * @access  Private (to be secured later)
 */
app.post('/api/business-units', async (req, res) => {
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
 * @route   GET /api/business-units
 * @desc    Retrieves a list of all business units.
 * @access  Private (to be secured later)
 */
app.get('/api/business-units', async (req, res) => {
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

/**
 * @route   POST /api/users/register
 * @desc    Registers a new user.
 * @access  Public
 */
app.post('/api/users/register', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    // Check if user already exists
    const userExistsQuery = 'SELECT * FROM users WHERE email = $1';
    const existingUser = await pool.query(userExistsQuery, [email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10); // Generate a salt
    const passwordHash = await bcrypt.hash(password, salt); // Create the hash

    // Store the new user in the database
    const insertUserQuery = `
      INSERT INTO users (email, password_hash) 
      VALUES ($1, $2) 
      RETURNING id, email, created_at;
    `;
    const newUser = await pool.query(insertUserQuery, [email, passwordHash]);

    // Send back the new user's data (without the password hash!)
    res.status(201).json(newUser.rows[0]);

  } catch (error) {
    console.error('Error during user registration:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

/**
 * @route   POST /api/users/login
 * @desc    Authenticates a user and returns a JWT token.
 * @access  Public
 */
app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Find the user by their email
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(userQuery, [email]);
    const user = result.rows[0];

    // If no user is found, the credentials are bad
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    // Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);

    // If passwords don't match, the credentials are bad
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    // --- If credentials are correct, create and sign a JWT ---
    
    // The "payload" is the data we want to store inside the token
    const payload = {
      user: {
        id: user.id // Store the user's ID in the token
      }
    };

    // Sign the token with our secret key, and set it to expire in 1 hour
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' }, // Token expires in 1 hour
      (err, token) => {
        if (err) throw err; // If signing fails, throw an error
        // Send the token back to the user
        res.json({ token });
      }
    );

  } catch (error) {
    console.error('Error during user login:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});


// --- Start the Server ---

// Make the application listen on the specified port
app.listen(port, () => {
  console.log(`Server is successfully listening on port ${port}`);
});