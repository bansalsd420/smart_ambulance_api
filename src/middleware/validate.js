const { validationResult } = require('express-validator');

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation errors to server console for easier debugging
    console.error('Validation failed for', req.method, req.originalUrl, errors.array());
    return res.status(422).json({ errors: errors.array() });
  }
  next();
};
