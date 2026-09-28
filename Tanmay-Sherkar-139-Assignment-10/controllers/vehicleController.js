const supabase = require('../config/supabase');

const VALID_CATEGORIES = ['Sedan', 'SUV', 'Luxury', 'Hatchback', 'Electric'];
const VALID_STATUSES = ['available', 'rented', 'maintenance'];

const getAllVehicles = async (req, res, next) => {
  try {
    const { category, status } = req.query;
    let query = supabase.from('vehicles').select('*');

    if (category) {
      query = query.eq('category', category);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('id', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

const getVehicleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vehicles')
      .select('*, rentals(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

const createVehicle = async (req, res, next) => {
  try {
    const { brand, model, year, category, daily_rate, fuel_type, seating_capacity, status } = req.body;

    if (!brand || !model || !year || !category || !daily_rate || !fuel_type) {
      return res.status(400).json({ error: 'Missing required vehicle fields' });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
      });
    }

    const numericDailyRate = parseFloat(daily_rate);
    if (isNaN(numericDailyRate) || numericDailyRate <= 0) {
      return res.status(400).json({ error: 'daily_rate must be a positive number' });
    }

    const vehicleStatus = status || 'available';
    if (!VALID_STATUSES.includes(vehicleStatus)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    const { data, error } = await supabase
      .from('vehicles')
      .insert([
        {
          brand,
          model,
          year: parseInt(year, 10),
          category,
          daily_rate: numericDailyRate,
          fuel_type,
          seating_capacity: seating_capacity ? parseInt(seating_capacity, 10) : 5,
          status: vehicleStatus
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      message: 'Vehicle created successfully',
      vehicle: data
    });
  } catch (err) {
    next(err);
  }
};

const updateVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const updates = {};

    if (req.body.daily_rate !== undefined) {
      const numericDailyRate = parseFloat(req.body.daily_rate);
      if (isNaN(numericDailyRate) || numericDailyRate <= 0) {
        return res.status(400).json({ error: 'daily_rate must be a positive number' });
      }
      updates.daily_rate = numericDailyRate;
    }

    if (req.body.status !== undefined) {
      if (!VALID_STATUSES.includes(req.body.status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
        });
      }
      updates.status = req.body.status;
    }

    if (req.body.brand !== undefined) updates.brand = req.body.brand;
    if (req.body.model !== undefined) updates.model = req.body.model;
    if (req.body.year !== undefined) updates.year = parseInt(req.body.year, 10);
    if (req.body.category !== undefined) {
      if (!VALID_CATEGORIES.includes(req.body.category)) {
        return res.status(400).json({
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
        });
      }
      updates.category = req.body.category;
    }
    if (req.body.fuel_type !== undefined) updates.fuel_type = req.body.fuel_type;
    if (req.body.seating_capacity !== undefined) updates.seating_capacity = parseInt(req.body.seating_capacity, 10);

    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Vehicle updated successfully',
      vehicle: data
    });
  } catch (err) {
    next(err);
  }
};

const deleteVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: vehicle, error: findError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const { data: activeRentals, error: rentalError } = await supabase
      .from('rentals')
      .select('id')
      .eq('vehicle_id', id)
      .in('status', ['booked', 'active']);

    if (activeRentals && activeRentals.length > 0) {
      return res.status(400).json({ error: 'Cannot delete vehicle with active or booked rentals' });
    }

    const { error: deleteError } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return res.status(400).json({ error: deleteError.message });
    }

    return res.status(200).json({ message: 'Vehicle deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
};
