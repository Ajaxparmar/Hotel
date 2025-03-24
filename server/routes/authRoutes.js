const express = require('express');
const router = express.Router();
const cors = require('cors');
const { poolPromise } = require('../index'); // Import poolPromise from main file
const {
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
  getRoomByHotel,
} = require('../controllers/authController');
const { verifyAdmin } = require('../utils/verifyToken');

// Middleware
router.use(
  cors({
    credentials: true,
    origin: 'http://localhost:5173',
  })
);

// Routes with poolPromise passed to controller functions
router.get('/', (req, res) => test(req, res, poolPromise));
router.post('/register', (req, res) => registerUser(req, res, poolPromise));
router.post('/login', (req, res) => loginUser(req, res, poolPromise));
router.get('/profile', (req, res) => getProfile(req, res, poolPromise));
router.get('/logout', (req, res) => logout(req, res, poolPromise));
router.post('/hotels/new', (req, res) => createHotel(req, res, poolPromise));

// UPDATE
router.put('/hotels/:id', verifyAdmin, (req, res) => updateHotel(req, res, poolPromise));

// DELETE
router.delete('/hotels/:id', (req, res) => deleteHotel(req, res, poolPromise));

// GET
router.get('/hotels/find/:id', (req, res) => getHotel(req, res, poolPromise));

// GET ALL
router.get('/hotels/', (req, res) => getHotels(req, res, poolPromise));
router.get('/hotels/countByCity', (req, res) => countByCity(req, res, poolPromise));
router.get('/hotels/countByType', (req, res) => countByType(req, res, poolPromise));
router.get('/hotels/room/:id', (req, res) => getHotelRooms(req, res, poolPromise));
router.post('/room/:hotelid', (req, res) => createRoom(req, res, poolPromise));

// UPDATE
router.put('/room/availability/:id/:roomNumber', (req, res) => updateRoomAvailability(req, res, poolPromise));
router.put('/room/:id', verifyAdmin, (req, res) => updateRoom(req, res, poolPromise));

// DELETE
router.delete('/room/:id', (req, res) => deleteRoom(req, res, poolPromise));

// GET
router.get('/room/:id', (req, res) => getRoom(req, res, poolPromise));

// Admin routes
router.post('/admin/login', (req, res) => adminLogin(req, res, poolPromise));
router.post('/admin/register', (req, res) => adminRegister(req, res, poolPromise));
router.get('/reserved/:id', (req, res) => reserved(req, res, poolPromise));
router.post('/delreserve', (req, res) => delReserved(req, res, poolPromise));
router.get('/room/:id/:hotelid', (req, res) => getRoomByHotel(req, res, poolPromise));

module.exports = router;