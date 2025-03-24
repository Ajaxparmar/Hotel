const { pool } = require('../index');  // Import the connection pool from index.js
const { hashPassword, comparePassword } = require('../helpers/auth')
const jwt = require('jsonwebtoken');
const { poolPromise, sql } = require('../index');
const test = (req, res) => {
  res.json('test is working');
};
//Register Endpoint
// const registerUser = async (req, res) => {
//   try {
//     const { name, email, password } = req.body;
//     console.log(req.body);
    
//     // Check if email is missing or empty
//     if (!email) {
//       return res.json({
//         error: 'Email is required',
//       });
//     }

//     // Check if name was entered
//     if (!name) {
//       return res.json({
//         error: 'Name is required',
//       });
//     }

//     // Check if password is good
//     if (!password || password.length < 6) {
//       return res.json({
//         error: 'Password is required and should be at least 6 characters long',
//       });
//     }

//     // Check email
//     const [rows, fields] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

//     if (rows.length > 0) {
//       return res.json({
//         error: 'Email is taken already',
//       });
//     }

//     const hashedPassword = await hashPassword(password)
//     // Insert a new user into the MySQL database
//     await pool.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword]);

//     return res.json({ success: true, message: 'User registered successfully' });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({ success: false, message: 'User registration failed' });
//   }
// };

const registerUser = async (req, res, poolPromise) => {
  try {
    const pool = await poolPromise; // Resolve the pool
    const { name, email, password } = req.body;
    console.log(req.body);

    if (!email) return res.json({ error: 'Email is required' });
    if (!name) return res.json({ error: 'Name is required' });
    if (!password || password.length < 6) {
      return res.json({ error: 'Password is required and should be at least 6 characters long' });
    }

    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT * FROM users WHERE email = @email');
    if (result.recordset.length > 0) {
      return res.json({ error: 'Email is taken already' });
    }

    const hashedPassword = await hashPassword(password);
    await pool.request()
      .input('name', sql.VarChar, name)
      .input('email', sql.VarChar, email)
      .input('password', sql.VarChar, hashedPassword)
      .query('INSERT INTO users (name, email, password) VALUES (@name, @email, @password)');

    return res.json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: 'User registration failed' });
  }
};

//Login Endpoint
const loginUser = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const { email, password } = req.body;

    // Check if user exists
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT * FROM users WHERE email = @email');

    if (result.recordset.length === 0) {
      return res.json({ error: 'No user found' });
    }

    const user = result.recordset[0]; // First row is the user

    // Compare the provided password with the stored hashed password
    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.json({ error: 'Incorrect password' });
    }

    // Sign JWT token
    jwt.sign(
      { email: user.email, id: user.id, name: user.name },
      process.env.JWT_SECRET,
      {},
      (err, token) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ success: false, message: 'Login failed' });
        }

        res.cookie('token', token).json(user);
      }
    );
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
};

const getProfile = (req, res) => {
  const { token } = req.cookies;
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET, {}, (err, user) => {
        if (err) {
          return res.status(401).json({ error: 'Invalid token' });
        }
        res.json(user);
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'Server error during token verification' });
    }
  } else {
    res.status(401).json({ message: 'No token provided' });
  }
};

const logout = (req, res) => {
  res.clearCookie('token').json({ success: true, message: 'User logged out successfully' });
};

const createHotel = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const {
      name,
      type,
      city,
      address,
      distance,
      photos,
      title,
      desc,
      rating,
      cheapestPrice,
      featured,
    } = req.body;

    // Convert featured to 0 or 1 (SQL Server uses BIT)
    const featuredValue = featured === 'true' ? 1 : 0;

    // Prepare parameters, handling undefined values and converting photos to JSON
    const request = pool.request()
      .input('name', sql.VarChar, name || null)
      .input('type', sql.VarChar, type || null)
      .input('city', sql.VarChar, city || null)
      .input('address', sql.VarChar, address || null)
      .input('distance', sql.VarChar, distance || null)
      .input('photos', sql.NVarChar, photos ? JSON.stringify(photos) : null)
      .input('title', sql.VarChar, title || null)
      .input('desc', sql.NVarChar, desc || null) // Use NVarChar for potentially longer text
      .input('rating', sql.Float, rating || null)
      .input('cheapestPrice', sql.Decimal(10, 2), cheapestPrice || null)
      .input('featured', sql.Bit, featuredValue);

    // Insert the new hotel into the 'hotels' table
    await request.query(`
      INSERT INTO hotels (name, type, city, address, distance, photos, title, description, rating, cheapestPrice, featured)
      VALUES (@name, @type, @city, @address, @distance, @photos, @title, @desc, @rating, @cheapestPrice, @featured)
    `);

    res.status(200).json({ success: true, message: 'Hotel added successfully.' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Failed to add hotel.' });
  }
};


const updateHotel = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const { name, location, cheapestPrice, type } = req.body;
    const hotelId = req.params.id;

    await pool.request()
      .input('name', sql.VarChar, name)
      .input('location', sql.VarChar, location) // Assuming 'location' is the intended column name
      .input('cheapestPrice', sql.Decimal(10, 2), cheapestPrice)
      .input('type', sql.VarChar, type)
      .input('id', sql.Int, hotelId)
      .query(`
        UPDATE hotels 
        SET name = @name, location = @location, cheapestPrice = @cheapestPrice, type = @type 
        WHERE id = @id
      `);

    res.status(200).json({ message: 'Hotel updated successfully' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to update hotel', error: err.message });
  }
};

const deleteHotel = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const hotelId = req.params.id;

    // Delete from 'unavailableDates' table
    await pool.request()
      .input('hotelId', sql.Int, hotelId)
      .query(`
        DELETE FROM unavailableDates 
        WHERE roomNumber_id IN (
          SELECT rn.id 
          FROM roomNumbers rn 
          JOIN rooms r ON rn.room_id = r.id 
          WHERE r.hotel_id = @hotelId
        )
      `);

    // Delete from 'roomNumbers' table
    await pool.request()
      .input('hotelId', sql.Int, hotelId)
      .query(`
        DELETE FROM roomNumbers 
        WHERE room_id IN (
          SELECT id 
          FROM rooms 
          WHERE hotel_id = @hotelId
        )
      `);

    // Delete from 'rooms' table
    await pool.request()
      .input('hotelId', sql.Int, hotelId)
      .query('DELETE FROM rooms WHERE hotel_id = @hotelId');

    // Delete from 'hotels' table
    await pool.request()
      .input('hotelId', sql.Int, hotelId)
      .query('DELETE FROM hotels WHERE id = @hotelId');

    res.status(200).json({ message: 'Hotel deleted successfully' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to delete hotel', error: err.message });
  }
};


const getHotel = async (req, res) => {
  let pool;
  try {
    console.log("Testing get single hotel"); // Fixed typo
    pool = await poolPromise; // Resolve the pool from the promise
    const hotelId = req.params.id;
    console.log("Hotel ID:", hotelId);

    const result = await pool.request()
      .input('id', sql.Int, hotelId)
      .query('SELECT * FROM hotels WHERE id = @id');

    res.status(200).json(result.recordset[0] || null);
    console.log(result); // Return first record or null if not found
  }
  
  
   catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to get hotel', error: err.message });
  }
};

const getHotels = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const { min, max, city, limit, ...others } = req.query;
    console.log("testing get holtel");
    
    // Build the query with parameters
    let query = 'SELECT * FROM hotels WHERE 1 = 1';
    const request = pool.request();

    if (city) {
      query += ' AND city = @city';
      request.input('city', sql.VarChar, city);
    }

    if (min) {
      query += ' AND cheapestPrice >= @min';
      request.input('min', sql.Decimal(10, 2), min);
    }

    if (max) {
      query += ' AND cheapestPrice <= @max';
      request.input('max', sql.Decimal(10, 2), max);
    }

    query += ' ORDER BY id'; // Optional: Add sorting for consistency
    query += ' OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY'; // MSSQL LIMIT equivalent
    request.input('limit', sql.Int, parseInt(limit) || 100);

    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to get hotels', error: err.message });
  }
};




const countByCity = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const cities = req.query.cities.split(',');

    // Build dynamic parameterized query for IN clause
    const placeholders = cities.map((_, index) => `@city${index}`).join(', ');
    const query = `
      SELECT city, COUNT(*) AS count 
      FROM hotels 
      WHERE city IN (${placeholders}) 
      GROUP BY city
    `;
    const request = pool.request();
    cities.forEach((city, index) => {
      request.input(`city${index}`, sql.VarChar, city);
    });

    const result = await request.query(query);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to count by city', error: err.message });
  }
};

const countByType = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise

    const result = await pool.request().query(`
      SELECT 
        type,
        COUNT(*) AS count 
      FROM hotels 
      WHERE type IN ('hotel', 'apartment', 'resort', 'villa', 'cabin') 
      GROUP BY type
    `);

    // Format the response to match your desired output
    const counts = [
      { type: 'hotel', count: 0 },
      { type: 'apartments', count: 0 },
      { type: 'resorts', count: 0 },
      { type: 'villas', count: 0 },
      { type: 'cabins', count: 0 },
    ];

    result.recordset.forEach(row => {
      const typeKey = row.type === 'hotel' ? 'hotel' :
                      row.type === 'apartment' ? 'apartments' :
                      row.type === 'resort' ? 'resorts' :
                      row.type === 'villa' ? 'villas' : 'cabins';
      const index = counts.findIndex(item => item.type === typeKey);
      if (index !== -1) counts[index].count = row.count;
    });

    res.status(200).json(counts);
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to count by type', error: err.message });
  }
};

const getHotelRooms = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const hotelId = req.params.id;

    const roomsResult = await pool.request()
      .input('hotelId', sql.Int, hotelId)
      .query('SELECT * FROM rooms WHERE hotel_id = @hotelId');

    const list = roomsResult.recordset;

    // Fetch roomNumbers and unavailableDates for each room
    const roomsWithRoomNumbers = await Promise.all(
      list.map(async (room) => {
        const roomNumbersResult = await pool.request()
          .input('roomId', sql.Int, room.id)
          .query('SELECT * FROM roomNumbers WHERE room_id = @roomId');
        const roomNumbersData = roomNumbersResult.recordset;

        const roomNumbersWithUnavailableDates = await Promise.all(
          roomNumbersData.map(async (roomNumber) => {
            const unavailableDatesResult = await pool.request()
              .input('roomNumberId', sql.Int, roomNumber.id)
              .query('SELECT * FROM unavailableDates WHERE roomNumber_id = @roomNumberId');
            return { ...roomNumber, unavailableDates: unavailableDatesResult.recordset };
          })
        );

        return { ...room, roomNumbers: roomNumbersWithUnavailableDates };
      })
    );

    res.status(200).json(roomsWithRoomNumbers);
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to get hotel rooms', error: err.message });
  }
};



const createRoom = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const hotelId = req.params.hotelid;
    const { title, price, maxPeople, desc, roomNumbers } = req.body;

    // Insert the new room into the 'rooms' table
    const roomResult = await pool.request()
      .input('hotel_id', sql.Int, hotelId)
      .input('title', sql.VarChar, title)
      .input('price', sql.Decimal(10, 2), price)
      .input('maxPeople', sql.Int, maxPeople)
      .input('description', sql.NVarChar, desc)
      .query(`
        INSERT INTO rooms (hotel_id, title, price, maxPeople, description) 
        OUTPUT INSERTED.id 
        VALUES (@hotel_id, @title, @price, @maxPeople, @description)
      `);

    const roomId = roomResult.recordset[0].id;

    // Insert room numbers into the 'roomNumbers' table
    const insertRoomNumbersPromises = roomNumbers.map(async (roomNumber) => {
      await pool.request()
        .input('room_id', sql.Int, roomId)
        .input('number', sql.VarChar, roomNumber.number)
        .query('INSERT INTO roomNumbers (room_id, number) VALUES (@room_id, @number)');
    });

    await Promise.all(insertRoomNumbersPromises);

    res.status(200).json({ success: true, message: 'Room added successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to add room.' });
  }
};

const updateRoomAvailability = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const roomId = req.params.id;
    const roomNumberId = req.params.roomNumber;
    const timestamps = req.body.dates;

    if (!Array.isArray(timestamps)) {
      return res.status(400).json({ error: 'Dates should be an array of timestamps' });
    }

    // Assuming userId comes from the request body or token (adjust as needed)
    const userId = req.body.userId;

    // Insert unavailable dates
    await Promise.all(timestamps.map(async (timestamp) => {
      const date = new Date(timestamp);
      await pool.request()
        .input('roomNumber_id', sql.Int, roomNumberId)
        .input('date', sql.DateTime, date)
        .input('user_id', sql.Int, userId)
        .query('INSERT INTO unavailableDates (roomNumber_id, date, user_id) VALUES (@roomNumber_id, @date, @user_id)');
    }));

    // Update roomNumbers timestamp
    await pool.request()
      .input('id', sql.Int, roomNumberId)
      .query('UPDATE roomNumbers SET updated_at = GETDATE() WHERE id = @id');

    res.status(200).json('Room status has been updated.');
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update room availability', error: err.message });
  }
};

const updateRoom = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const roomId = req.params.id;
    const { name, type, capacity, price, description } = req.body;

    await pool.request()
      .input('name', sql.VarChar, name)
      .input('type', sql.VarChar, type)
      .input('capacity', sql.Int, capacity)
      .input('price', sql.Decimal(10, 2), price)
      .input('description', sql.NVarChar, description)
      .input('id', sql.Int, roomId)
      .query(`
        UPDATE rooms 
        SET name = @name, type = @type, capacity = @capacity, price = @price, description = @description 
        WHERE id = @id
      `);

    const result = await pool.request()
      .input('id', sql.Int, roomId)
      .query('SELECT * FROM rooms WHERE id = @id');

    res.status(200).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update room', error: err.message });
  }
};

const deleteRoom = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const roomId = req.params.id;

    // Delete from 'unavailableDates' table
    await pool.request()
      .input('roomId', sql.Int, roomId)
      .query(`
        DELETE FROM unavailableDates 
        WHERE roomNumber_id IN (SELECT id FROM roomNumbers WHERE room_id = @roomId)
      `);

    // Delete from 'roomNumbers' table
    await pool.request()
      .input('roomId', sql.Int, roomId)
      .query('DELETE FROM roomNumbers WHERE room_id = @roomId');

    // Delete from 'rooms' table
    await pool.request()
      .input('roomId', sql.Int, roomId)
      .query('DELETE FROM rooms WHERE id = @roomId');

    res.status(200).json('Room has been deleted.');
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete room', error: err.message });
  }
};



const getRoom = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const roomId = req.params.id;

    const result = await pool.request()
      .input('hotelId', sql.Int, roomId) // Assuming roomId is actually hotel_id based on query
      .query(`
        SELECT rooms.id, rooms.title, rooms.price, rooms.maxPeople, rooms.description 
        FROM rooms 
        JOIN hotels ON rooms.hotel_id = hotels.id 
        WHERE rooms.hotel_id = @hotelId
      `);

    res.status(200).json(result.recordset); // Return all matching rooms (array)
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to get room', error: err.message });
  }
};

const adminLogin = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const { email, password } = req.body;

    // Check if user exists
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT * FROM admin_users WHERE email = @email');

    if (result.recordset.length === 0) {
      return res.json({ error: 'No user found' });
    }

    const user = result.recordset[0]; // First row is the user

    // Compare the provided password with the stored hashed password
    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.json({ error: 'Incorrect password' });
    }

    // Sign JWT token
    jwt.sign(
      { email: user.email, id: user.id, name: user.name },
      process.env.JWT_SECRET,
      {},
      (err, token) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ success: false, message: 'Login failed' });
        }
        res.cookie('token', token).json(user);
      }
    );
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
};

const adminRegister = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const { name, email, password } = req.body;

    if (!email) {
      return res.json({ error: 'Email is required' });
    }

    if (!name) {
      return res.json({ error: 'Name is required' });
    }

    if (!password || password.length < 6) {
      return res.json({ error: 'Password is required and should be at least 6 characters long' });
    }

    // Check if email exists
    const checkResult = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT * FROM admin_users WHERE email = @email');

    if (checkResult.recordset.length > 0) {
      return res.json({ error: 'Email is taken already' });
    }

    const hashedPassword = await hashPassword(password);

    // Insert new admin user
    await pool.request()
      .input('name', sql.VarChar, name)
      .input('email', sql.VarChar, email)
      .input('password', sql.VarChar, hashedPassword)
      .query('INSERT INTO admin_users (name, email, password) VALUES (@name, @email, @password)');

    return res.json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: 'User registration failed' });
  }
};


const reserved = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const userId = req.params.id;

    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT
          hotels.name AS hotel_name,
          hotels.title AS hotel_title,
          hotels.type AS hotel_type,
          hotels.city AS hotel_city,
          hotels.address AS hotel_address,
          hotels.photos AS hotel_photos,
          hotels.[desc] AS hotels_desc, -- 'desc' is a reserved keyword in MSSQL
          hotels.rating AS hotels_rating,
          rooms.title AS rooms_title,
          rooms.price AS rooms_price,
          rooms.maxPeople AS rooms_maxpeople,
          rooms.description AS rooms_description,
          roomNumbers.number AS rooms_number,
          unavailableDates.date AS booked_date,
          hotels.id AS hotel_id,
          rooms.id AS rooms_id,
          roomNumbers.id AS roomNumbers_id,
          unavailableDates.id AS unavailableDates_id
        FROM users
        JOIN unavailableDates ON users.id = unavailableDates.user_id
        JOIN roomNumbers ON unavailableDates.roomNumber_id = roomNumbers.id
        JOIN rooms ON roomNumbers.room_id = rooms.id
        JOIN hotels ON rooms.hotel_id = hotels.id 
        WHERE users.id = @userId
      `);

    if (result.recordset.length === 0) {
      return res.status(200).json({ message: 'No reservations found for the user.' });
    }

    res.status(200).json(result.recordset);
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to get reservations', error: err.message });
  }
};

const delReserved = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const { unavailId } = req.body;

    const result = await pool.request()
      .input('unavailId', sql.Int, unavailId)
      .query('DELETE FROM unavailableDates WHERE id = @unavailId');

    if (result.rowsAffected[0] === 0) { // MSSQL uses rowsAffected instead of affectedRows
      return res.json({ error: 'Cancellation Failed' });
    }

    return res.json({ success: true, message: 'Successfully Canceled' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Cancellation Failed' });
  }
};

const getRoomByHotel = async (req, res) => {
  let pool;
  try {
    pool = await poolPromise; // Resolve the pool from the promise
    const roomId = req.params.id;

    const result = await pool.request()
      .input('roomId', sql.Int, roomId)
      .query('SELECT * FROM rooms WHERE id = @roomId');

    res.status(200).json(result.recordset[0] || null); // Return first room or null if not found
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to get room', error: err.message });
  }
};
module.exports = {
  test,
  registerUser,
  loginUser,
  getProfile,
  logout,
  countByCity,
    countByType,
    createHotel,
    deleteHotel,
    getHotel,
    getHotelRooms,
    getHotels,
    updateHotel,
    createRoom,
  deleteRoom,
  getRoom,
  updateRoom,
  updateRoomAvailability,
  adminLogin,
  adminRegister,
  reserved,
  delReserved,
  getRoomByHotel
};
