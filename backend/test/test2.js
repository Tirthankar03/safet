import mongoose from 'mongoose';
import { processNewMarkers } from '../utils/clustering.js';
import Marker from '../models/Marker.js';
import RegionMap from '../models/RegionMap.js';
// import { processNewMarkers } from './processMarkers.js';
// import { Marker } from './models/Marker.js';
// import { RegionMap } from './models/RegionMap.js';

// Test data: Creating several clusters of markers in different areas
const testMarkers = [
    // Cluster 1: Downtown Seattle area
    { coordinates: { type: 'Point', coordinates: [-122.3321, 47.6062] } },
    { coordinates: { type: 'Point', coordinates: [-122.3325, 47.6065] } },
    { coordinates: { type: 'Point', coordinates: [-122.3318, 47.6060] } },
    { coordinates: { type: 'Point', coordinates: [-122.3330, 47.6068] } },
    
    // Cluster 2: Capitol Hill area
    { coordinates: { type: 'Point', coordinates: [-122.3215, 47.6183] } },
    { coordinates: { type: 'Point', coordinates: [-122.3220, 47.6185] } },
    { coordinates: { type: 'Point', coordinates: [-122.3210, 47.6180] } },
    { coordinates: { type: 'Point', coordinates: [-122.3225, 47.6188] } },
    
    // Cluster 3: University District
    { coordinates: { type: 'Point', coordinates: [-122.3132, 47.6532] } },
    { coordinates: { type: 'Point', coordinates: [-122.3135, 47.6535] } },
    { coordinates: { type: 'Point', coordinates: [-122.3130, 47.6530] } },
    { coordinates: { type: 'Point', coordinates: [-122.3138, 47.6538] } },
    
    // Noise points (outliers)
    { coordinates: { type: 'Point', coordinates: [-122.3800, 47.6200] } },
    { coordinates: { type: 'Point', coordinates: [-122.3000, 47.5900] } },
    
    // Point close to Downtown Seattle cluster (potential processed outlier)
    { coordinates: { type: 'Point', coordinates: [-122.3400, 47.6100] } },
    
    // New Cluster 4: Bellevue area (3 points to form a new cluster)
    { coordinates: { type: 'Point', coordinates: [-122.2000, 47.6150] } },
    { coordinates: { type: 'Point', coordinates: [-122.2010, 47.6155] } },
    { coordinates: { type: 'Point', coordinates: [-122.2005, 47.6160] } }
  ];

async function testClustering() {
  try {
    // Connect to MongoDB (replace with your connection string)
    await mongoose.connect('mongodb://localhost:27017/geo_test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Clear existing data
    await Promise.all([
      Marker.deleteMany({}),
      RegionMap.deleteMany({})
    ]);
    
    // Insert test markers
    await Marker.insertMany(testMarkers);
    
    // Run the clustering process
    const result = await processNewMarkers();
    
    // Fetch and display results
    const regions = await RegionMap.find({});
    console.log('Clustering Results:', result);
    console.log('Number of regions created:', regions.length);
    
    // Display each region's details
    for (const region of regions) {
      console.log('\nRegion:', {
        location: region.location,
        centerPoint: region.centralCoord.coordinates,
        numMarkers: region.markers.length,
        boundaryPoints: region.boundary.coordinates[0].length
      });
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the test
testClustering();