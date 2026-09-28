const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
} = require('../controllers/vehicleController');

router.get('/', getAllVehicles);
router.get('/:id', getVehicleById);
router.post('/', authenticate, createVehicle);
router.put('/:id', authenticate, updateVehicle);
router.delete('/:id', authenticate, deleteVehicle);

module.exports = router;
