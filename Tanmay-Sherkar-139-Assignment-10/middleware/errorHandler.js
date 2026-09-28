const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;
