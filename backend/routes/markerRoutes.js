import express from 'express';
import {
  createMarker,
  getAllMarkers,
  getMarkerById,
  updateMarker,
  deleteMarker
} from '../controllers/markerController.js';

const router = express.Router();

// Routes for markers
router.post('/', createMarker);        // Create a new marker
router.get('/', getAllMarkers);        // Get all markers
router.get('/:id', getMarkerById);     // Get a marker by ID
router.put('/:id', updateMarker);      // Update a marker by ID
router.delete('/:id', deleteMarker);   // Delete a marker by ID

export default router;
