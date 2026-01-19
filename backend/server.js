const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'smart_parking',
  password: 'your_password',
  port: 5432,
});

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize database
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parked_cars (
        plate VARCHAR(20) PRIMARY KEY,
        floor INT NOT NULL,
        spot VARCHAR(10) NOT NULL,
        parked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        image_data BYTEA
      );
    `);
    console.log('Database initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

initDB();

// API Endpoints

// 1. Save parking data (called by AI service)
app.post('/park', async (req, res) => {
  try {
    const { plate, floor, spot, imageData } = req.body;
    
    if (!plate || !floor || !spot) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `
      INSERT INTO parked_cars (plate, floor, spot, image_data)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (plate) 
      DO UPDATE SET floor = $2, spot = $3, parked_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    
    const result = await pool.query(query, [plate, floor, spot, imageData || null]);
    
    res.json({
      success: true,
      message: 'Car parked successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error parking car:', err);
    res.status(500).json({ error: 'Failed to park car' });
  }
});

// 2. Find car location by plate
app.get('/find/:plate', async (req, res) => {
  try {
    const { plate } = req.params;
    
    const query = 'SELECT plate, floor, spot, parked_at FROM parked_cars WHERE plate = $1';
    const result = await pool.query(query, [plate.toUpperCase()]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error finding car:', err);
    res.status(500).json({ error: 'Failed to find car' });
  }
});

// 3. Upload image and detect plate (integration endpoint)
app.post('/upload-car', upload.single('image'), async (req, res) => {
  try {
    const { floor, spot } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Convert image to base64
    const imageBase64 = req.file.buffer.toString('base64');
    
    // Call Python AI service
    const aiResponse = await axios.post('http://localhost:5000/detect-plate', {
      image: imageBase64,
      floor: parseInt(floor),
      spot: spot
    });
    
    if (aiResponse.data.success) {
      res.json({
        success: true,
        plate: aiResponse.data.plate,
        floor: aiResponse.data.floor,
        spot: aiResponse.data.spot
      });
    } else {
      res.status(400).json({ error: 'Could not detect license plate' });
    }
  } catch (err) {
    console.error('Error processing upload:', err);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// 4. Get all parked cars (for admin view)
app.get('/all-cars', async (req, res) => {
  try {
    const query = 'SELECT plate, floor, spot, parked_at FROM parked_cars ORDER BY parked_at DESC';
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching cars:', err);
    res.status(500).json({ error: 'Failed to fetch cars' });
  }
});

// 5. Remove car (when leaving)
app.delete('/leave/:plate', async (req, res) => {
  try {
    const { plate } = req.params;
    
    const query = 'DELETE FROM parked_cars WHERE plate = $1 RETURNING *';
    const result = await pool.query(query, [plate.toUpperCase()]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }
    
    res.json({
      success: true,
      message: 'Car removed successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error removing car:', err);
    res.status(500).json({ error: 'Failed to remove car' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Smart Parking API is running' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});