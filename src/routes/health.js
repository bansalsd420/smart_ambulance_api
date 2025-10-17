const router = require('express').Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'smart-ambulance-api', time: new Date().toISOString() });
});

module.exports = router;
