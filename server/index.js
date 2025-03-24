const express = require('express');
const dotenv = require('dotenv').config();
const cors = require('cors');
const sql = require('mssql');
const cookieParser = require('cookie-parser');

const app = express();
const port = 8000;

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  port: 1433,
  options: { encrypt: true, trustServerCertificate: true },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log('Connected to SQL Server database');
    return pool;
  })
  .catch(err => {
    console.error('Error connecting to SQL Server:', err);
    throw err;
  });

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(cors({ credentials: true, origin: 'http://localhost:5173' }));

module.exports = { poolPromise, sql }; // Export before using routes

app.use('/', require('./routes/authRoutes'));

app.listen(port, () => console.log('Server is running on port', port));