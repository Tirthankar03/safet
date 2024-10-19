// import { Marker } from "../models/RegionMap.js";

import Marker from "../models/Marker.js";


// Create a new marker
export const createMarker = async (req, res) => {
  try {
    const marker = new Marker(req.body);
    await marker.save();
    res.status(201).json(marker);
  } catch (error) {
    console.error('Error creating marker:', error);
    res.status(400).json({ error: 'Failed to create marker', details: error.message });
  }
};

// Get all markers
export const getAllMarkers = async (req, res) => {
  try {
    const markers = await Marker.find();
    res.json(markers);
  } catch (error) {
    console.error('Error fetching markers:', error);
    res.status(500).json({ error: 'Failed to fetch markers' });
  }
};

// Get a marker by ID
export const getMarkerById = async (req, res) => {
  try {
    const marker = await Marker.findById(req.params.id);
    if (!marker) {
      return res.status(404).json({ error: 'Marker not found' });
    }
    res.json(marker);
  } catch (error) {
    console.error('Error fetching marker:', error);
    res.status(500).json({ error: 'Failed to fetch marker' });
  }
};

// Update a marker by ID
export const updateMarker = async (req, res) => {
  try {
    const marker = await Marker.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!marker) {
      return res.status(404).json({ error: 'Marker not found' });
    }
    res.json(marker);
  } catch (error) {
    console.error('Error updating marker:', error);
    res.status(400).json({ error: 'Failed to update marker', details: error.message });
  }
};

// Delete a marker by ID
export const deleteMarker = async (req, res) => {
  try {
    const marker = await Marker.findByIdAndDelete(req.params.id);
    if (!marker) {
      return res.status(404).json({ error: 'Marker not found' });
    }
    res.status(204).send(); // No content response
  } catch (error) {
    console.error('Error deleting marker:', error);
    res.status(500).json({ error: 'Failed to delete marker' });
  }
};
