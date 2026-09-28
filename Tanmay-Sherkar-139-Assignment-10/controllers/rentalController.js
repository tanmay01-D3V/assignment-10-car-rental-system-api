const supabase = require('../config/supabase');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const createRental = async (req, res, next) => {
  try {
    const { vehicle_id, start_date, end_date, customer_name, customer_email } = req.body;

    if (!vehicle_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'vehicle_id, start_date, and end_date are required' });
    }

    if (!DATE_REGEX.test(start_date) || !DATE_REGEX.test(end_date)) {
      return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format' });
    }

    const start = new Date(`${start_date}T00:00:00Z`);
    const end = new Date(`${end_date}T00:00:00Z`);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date values provided' });
    }

    if (end < start) {
      return res.status(400).json({ error: 'end_date must be greater than or equal to start_date' });
    }

    const name = customer_name || req.user.user_metadata?.name || 'Customer';
    const email = customer_email || req.user.email;

    if (!name || !email) {
      return res.status(400).json({ error: 'customer_name and customer_email are required' });
    }

    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicle_id)
      .single();

    if (vehicleError || !vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    if (vehicle.status === 'maintenance') {
      return res.status(400).json({ error: 'Vehicle is currently under maintenance' });
    }

    const { data: collisions, error: collisionError } = await supabase
      .from('rentals')
      .select('id, start_date, end_date, status')
      .eq('vehicle_id', vehicle_id)
      .in('status', ['booked', 'active'])
      .lte('start_date', end_date)
      .gte('end_date', start_date);

    if (collisionError) {
      return res.status(400).json({ error: collisionError.message });
    }

    if (collisions && collisions.length > 0) {
      return res.status(400).json({ error: 'Vehicle already reserved during this timeframe' });
    }

    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const rentalDays = diffDays === 0 ? 1 : diffDays;
    const total_cost = parseFloat((rentalDays * parseFloat(vehicle.daily_rate)).toFixed(2));

    const { data: rental, error: insertError } = await supabase
      .from('rentals')
      .insert([
        {
          user_id: req.user.id,
          vehicle_id: parseInt(vehicle_id, 10),
          customer_name: name,
          customer_email: email,
          start_date,
          end_date,
          total_cost,
          status: 'booked'
        }
      ])
      .select()
      .single();

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    if (vehicle.status === 'available') {
      await supabase
        .from('vehicles')
        .update({ status: 'rented' })
        .eq('id', vehicle_id);
    }

    return res.status(201).json({
      message: 'Rental booked successfully',
      rental,
      rental_days: rentalDays,
      daily_rate: vehicle.daily_rate,
      total_cost
    });
  } catch (err) {
    next(err);
  }
};

const getMyBookings = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('rentals')
      .select('*, vehicles(*)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

const cancelRental = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: rental, error: findError } = await supabase
      .from('rentals')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !rental) {
      return res.status(404).json({ error: 'Rental not found' });
    }

    if (rental.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to cancel this rental' });
    }

    if (rental.status === 'cancelled' || rental.status === 'completed') {
      return res.status(400).json({ error: 'Rental cannot be cancelled in its current state' });
    }

    const { data: updatedRental, error: updateError } = await supabase
      .from('rentals')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    const { data: remainingRentals } = await supabase
      .from('rentals')
      .select('id')
      .eq('vehicle_id', rental.vehicle_id)
      .in('status', ['booked', 'active']);

    if (!remainingRentals || remainingRentals.length === 0) {
      await supabase
        .from('vehicles')
        .update({ status: 'available' })
        .eq('id', rental.vehicle_id);
    }

    return res.status(200).json({
      message: 'Rental cancelled successfully',
      rental: updatedRental
    });
  } catch (err) {
    next(err);
  }
};

const completeRental = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: rental, error: findError } = await supabase
      .from('rentals')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !rental) {
      return res.status(404).json({ error: 'Rental not found' });
    }

    if (rental.status === 'completed' || rental.status === 'cancelled') {
      return res.status(400).json({ error: 'Rental is already completed or cancelled' });
    }

    const { data: updatedRental, error: updateError } = await supabase
      .from('rentals')
      .update({ status: 'completed' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    await supabase
      .from('vehicles')
      .update({ status: 'available' })
      .eq('id', rental.vehicle_id);

    return res.status(200).json({
      message: 'Rental completed and vehicle marked as available',
      rental: updatedRental
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRental,
  getMyBookings,
  cancelRental,
  completeRental
};
