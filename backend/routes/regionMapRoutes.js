// import express from 'express';
// import { apiLimiter } from '../middleware/rateLimiter.js';
// import RegionMapService from '../services/RegionMapService.js';

// const router = express.Router();

// router.post('/process-markers', apiLimiter, async (req, res) => {
//   try {
//     const service = new RegionMapService();
//     const result = await service.processNewMarkers();
//     res.json(result);
//   } catch (error) {
//     console.error('Error processing markers:', error);
//     res.status(500).json({ 
//       error: 'Internal server error',
//       details: process.env.NODE_ENV === 'development' ? error.message : undefined 
//     });
//   }
// });

// router.get('/find-region', apiLimiter, async (req, res) => {
//   try {
//     const { lat, lng } = req.query;
//     if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
//       return res.status(400).json({ error: 'Invalid coordinates' });
//     }

//     const regions = await RegionMap.find({
//       boundary: {
//         $geoIntersects: {
//           $geometry: {
//             type: 'Point',
//             coordinates: [parseFloat(lng), parseFloat(lat)]
//           }
//         }
//       }
//     }).select('-markers');  // Exclude markers array for performance

//     res.json(regions);
//   } catch (error) {
//     res.status(500).json({ 
//       error: 'Internal server error',
//       details: process.env.NODE_ENV === 'development' ? error.message : undefined 
//     });
//   }
// });

// export default router;










//3
import express from 'express';
import { processNewMarkers } from '../utils/clustering.js';

const router = express.Router();

router.post('/process-markers', async (req, res) => {
  try {
    const result = await processNewMarkers();
    res.json(result);
  } catch (error) {
    console.error('Error processing markers:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;