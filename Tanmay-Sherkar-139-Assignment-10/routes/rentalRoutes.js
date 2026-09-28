const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const {
  createRental,
  getMyBookings,
  cancelRental,
  completeRental
} = require('../controllers/rentalController');

router.post('/', authenticate, createRental);
router.get('/my-bookings', authenticate, getMyBookings);
router.patch('/:id/cancel', authenticate, cancelRental);
router.patch('/:id/complete', authenticate, completeRental);

module.exports = router;
