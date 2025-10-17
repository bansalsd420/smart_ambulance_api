const router = require('express').Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');

router.post(
  '/login',
  [body('email').isEmail(), body('password').isString().isLength({ min: 6 })],
  validate,
  authController.login
);

module.exports = router;
