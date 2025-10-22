const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const hospitalsRouter = require('./routes/hospitals');
const fleetsRouter = require('./routes/fleets');
const ambulancesRouter = require('./routes/ambulances');
const approvalsRouter = require('./routes/approvals');
const usersRouter = require('./routes/users');
const patientsRouter = require('./routes/patients');
const paramedicsRouter = require('./routes/paramedics');
const doctorsRouter = require('./routes/doctors');
const assignmentsRouter = require('./routes/assignments');
const connectionsRouter = require('./routes/connections');
const onboardingsRouter = require('./routes/onboardings');
const devicesRouter = require('./routes/devices');
const meetingsRouter = require('./routes/meetings');
const auditRouter = require('./routes/audit');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/hospitals', hospitalsRouter);
app.use('/api/fleets', fleetsRouter);
app.use('/api/ambulances', ambulancesRouter);
app.use('/api/ambulance-approvals', approvalsRouter);
app.use('/api/users', usersRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/paramedics', paramedicsRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api', assignmentsRouter); // nested routes use /:ambulanceId paths
app.use('/api', connectionsRouter);
app.use('/api/onboardings', onboardingsRouter);
app.use('/api', devicesRouter);
app.use('/api', meetingsRouter);
app.use('/api', auditRouter);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
