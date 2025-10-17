const { randomUUID } = require('crypto');

exports.token = async (req, res) => {
  const { onboarding_id, user_id, role } = req.body;
  // Placeholder ephemeral token; in real integration, call provider SDK
  const token = `meet_${randomUUID()}`;
  const url = `https://video.example.com/join/${onboarding_id}?token=${token}&u=${user_id}&r=${role}`;
  res.json({ token, url });
};
