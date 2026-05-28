const express = require('express');
const router  = express.Router();
const writer  = require('../db/writer');

// GET /api/events?sessionId=&eventType=&roomId=&limit=&offset=
router.get('/', async (req, res) => {
  try {
    const { sessionId, eventType, roomId, limit = '100', offset = '0' } = req.query;
    const evts = await writer.query({
      sessionId,
      eventType,
      roomId,
      limit:  parseInt(limit,  10),
      offset: parseInt(offset, 10),
    });
    res.json({ events: evts, count: evts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events — ingest one event or array of events
router.post('/', async (req, res) => {
  try {
    const body  = req.body;
    const evts  = Array.isArray(body) ? body : [body];
    await writer.writeMany(evts);
    res.json({ ok: true, written: evts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/stats
router.get('/stats', async (req, res) => {
  try {
    const s = await writer.stats();
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/replay/:sessionId
router.get('/replay/:sessionId', async (req, res) => {
  try {
    const evts = await writer.query({ sessionId: req.params.sessionId, limit: 1000 });
    res.json({ sessionId: req.params.sessionId, events: evts, count: evts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
