// //utils/clustering.js
// import express from 'express'
// import mongoose from 'mongoose';
// import NodeGeocoder from 'node-geocoder';
// import rateLimit from 'express-rate-limit';

// // Constants
// const THRESHOLD_DISTANCE =3000; // meters
// const MIN_CLUSTER_SIZE = 2;
// const GEOCODING_TIMEOUT = 5000;
// const MAX_RETRIES = 3;

// // Rate limiter middleware
// const apiLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100 // limit each IP to 100 requests per windowMs
// });

// // Improved Marker Schema
// const markerSchema = new mongoose.Schema({
//   coordinates: {
//     type: {
//       type: String,
//       enum: ['Point'],
//       default: 'Point'
//     },
//     coordinates: {
//       type: [Number],
//       required: true,
//       validate: {
//         validator: function(coords) {
//           return coords.length === 2 && 
//                  coords[1] >= -90 && coords[1] <= 90 && // latitude
//                  coords[0] >= -180 && coords[0] <= 180; // longitude
//         },
//         message: 'Invalid coordinates. Expected [longitude, latitude] format.'
//       }
//     }
//   },
//   processed: { type: Boolean, default: false }
// }, { timestamps: true });

// markerSchema.index({ coordinates: '2dsphere' });
// markerSchema.index({ processed: 1, createdAt: 1 });
// const Marker = mongoose.model('Marker', markerSchema);
// // Improved RegionMap Schema
// const regionMapSchema = new mongoose.Schema({
//   centralCoord: {
//     type: {
//       type: String,
//       enum: ['Point'],
//       default: 'Point'
//     },
//     coordinates: {
//       type: [Number],
//       required: true,
//       validate: {
//         validator: function(coords) {
//           return coords.length === 2 && 
//                  coords[1] >= -90 && coords[1] <= 90 && // latitude
//                  coords[0] >= -180 && coords[0] <= 180; // longitude
//         },
//         message: 'Invalid central coordinates'
//       }
//     }
//   },
//   boundary: {
//     type: {
//       type: String,
//       enum: ['Polygon'],
//       default: 'Polygon'
//     },
//     coordinates: {
//       type: [[[Number]]],
//       required: true,
//       validate: {
//         validator: function(coords) {
//           if (!coords.length || !coords[0].length) return false;
//           return coords[0].every(point => 
//             point.length === 2 &&
//             point[1] >= -90 && point[1] <= 90 &&
//             point[0] >= -180 && point[0] <= 180
//           );
//         },
//         message: 'Invalid boundary coordinates'
//       }
//     }
//   },
//   location: String,
//   markers: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Marker'
//   }],
//   markerCount: { type: Number, default: 0 }
// }, { timestamps: true });

// regionMapSchema.index({ centralCoord: '2dsphere' });
// regionMapSchema.index({ boundary: '2dsphere' });

// const RegionMap = mongoose.model('RegionMap', regionMapSchema);

// // Improved RegionMapService
// export class RegionMapService {
//   constructor() {
//     this.geocoder = NodeGeocoder({
//       provider: 'openstreetmap',
//       timeout: GEOCODING_TIMEOUT
//     });
//   }

//   async reverseGeocode(lat, lng, retryCount = 0) {
//     try {
//       const location = await this.geocoder.reverse({ lat, lon: lng });
//       return location[0]?.formattedAddress || 'Unknown Location';
//     } catch (error) {
//       if (retryCount < MAX_RETRIES) {
//         await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
//         return this.reverseGeocode(lat, lng, retryCount + 1);
//       }
//       console.error('Geocoding failed:', error);
//       return 'Unknown Location';
//     }
//   }

//   async processNewMarkers() {
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//       const startDate = new Date();
//       startDate.setHours(startDate.getHours() - 24);

//       // Combined aggregation pipeline for efficiency
//       const markersWithRegions = await Marker.aggregate([
//         {
//           $match: {
//             processed: false,
//             createdAt: { $gte: startDate }
//           }
//         },
//         {
//           $lookup: {
//             from: 'regionmaps',
//             let: { markerCoords: '$coordinates' },
//             pipeline: [
//               {
//                 $geoNear: {
//                   near: '$$markerCoords',
//                   distanceField: 'distance',
//                   maxDistance: THRESHOLD_DISTANCE,
//                   spherical: true
//                 }
//               },
//               { $limit: 1 }
//             ],
//             as: 'nearbyRegions'
//           }
//         }
//       ]).session(session);

//       // Process markers near existing regions
//       const updatePromises = markersWithRegions
//         .filter(m => m.nearbyRegions.length > 0)
//         .map(marker => 
//           this.updateRegion(marker.nearbyRegions[0]._id, marker._id, session)
//         );
      
//       await Promise.all(updatePromises);

//       // Create new clusters from remaining markers
//       const unassignedMarkers = markersWithRegions
//         .filter(m => m.nearbyRegions.length === 0)
//         .map(m => m._id);

//       if (unassignedMarkers.length >= MIN_CLUSTER_SIZE) {
//         await this.createClusters(unassignedMarkers, session);
//       }

//       // Mark all processed markers
//       await Marker.updateMany(
//         { _id: { $in: markersWithRegions.map(m => m._id) } },
//         { $set: { processed: true } },
//         { session }
//       );

//       await session.commitTransaction();
//       return { success: true, processedCount: markersWithRegions.length };

//     } catch (error) {
//       await session.abortTransaction();
//       throw error;
//     } finally {
//       session.endSession();
//     }
//   }

//   async createClusters(markerIds, session) {
//     const clusters = await Marker.aggregate([
//       {
//         $match: { _id: { $in: markerIds } }
//       },
//       {
//         $group: {
//           _id: null,
//           coordinates: { $push: '$coordinates.coordinates' }
//         }
//       },
//       {
//         $project: {
//           clusters: {
//             $function: {
//               body: function(coords) {
//                 // Implementation of DBSCAN clustering algorithm
//                 // This is a placeholder - you would implement actual DBSCAN here
//                 return [coords];
//               },
//               args: ['$coordinates'],
//               lang: 'js'
//             }
//           }
//         }
//       }
//     ]).session(session);

//     for (const cluster of clusters[0].clusters) {
//       if (cluster.length >= MIN_CLUSTER_SIZE) {
//         await this.createRegionFromCluster(cluster, markerIds, session);
//       }
//     }
//   }

//   async updateRegion(regionId, markerId, session) {
//     // 1. Validate inputs
//     if (!mongoose.Types.ObjectId.isValid(regionId) || !mongoose.Types.ObjectId.isValid(markerId)) {
//       throw new Error('Invalid region or marker ID');
//     }

//     // 2. Find region and marker in a single operation
//     const [region, marker] = await Promise.all([
//       RegionMap.findById(regionId).session(session),
//       Marker.findById(markerId).session(session)
//     ]);

//     if (!region || !marker) {
//       throw new Error('Region or marker not found');
//     }

//     try {
//       // 3. Calculate new boundary and center in a single aggregation pipeline
//       const [aggregationResult] = await RegionMap.aggregate([
//         {
//           $match: { _id: region._id }
//         },
//         {
//           $project: {
//             allMarkers: { 
//               $concatArrays: ['$markers', [markerId]]
//             }
//           }
//         },
//         {
//           $lookup: {
//             from: 'markers',
//             let: { markerIds: '$allMarkers' },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: { $in: ['$_id', '$$markerIds'] }
//                 }
//               },
//               {
//                 $group: {
//                   _id: null,
//                   coordinates: { $push: '$coordinates.coordinates' },
//                   centerLat: { $avg: { $arrayElemAt: ['$coordinates.coordinates', 1] } },
//                   centerLng: { $avg: { $arrayElemAt: ['$coordinates.coordinates', 0] } }
//                 }
//               },
//               {
//                 $project: {
//                   coordinates: 1,
//                   centerPoint: {
//                     type: 'Point',
//                     coordinates: ['$centerLng', '$centerLat']
//                   },
//                   boundary: {
//                     $cond: {
//                       if: { $gte: [{ $size: '$coordinates' }, 3] },
//                       then: {
//                         type: 'Polygon',
//                         coordinates: [{
//                           $concatArrays: [
//                             { $concaveHull: { 
//                               points: '$coordinates',
//                               distanceMultiplier: 6371000 // Earth's radius in meters
//                             }},
//                             [{ $arrayElemAt: [
//                               { $concaveHull: { 
//                                 points: '$coordinates',
//                                 distanceMultiplier: 6371000
//                               }}, 
//                               0
//                             ]}] // Close the polygon
//                           ]
//                         }]
//                       },
//                       else: {
//                         // For 2 points or less, create a small circle around the center
//                         $geoNearSphere: {
//                           center: '$centerPoint',
//                           radius: 100 // meters
//                         }
//                       }
//                     }
//                   }
//                 }
//               }
//             ],
//             as: 'calculated'
//           }
//         },
//         { $unwind: '$calculated' }
//       ]).session(session);

//       if (!aggregationResult) {
//         throw new Error('Failed to calculate new region properties');
//       }

//       const { centerPoint, boundary } = aggregationResult.calculated;

//       // 4. Get location name with retry and timeout
//       let location;
//       try {
//         const geocodeResult = await Promise.race([
//           this.geocoder.reverse({
//             lat: centerPoint.coordinates[1],
//             lon: centerPoint.coordinates[0]
//           }),
//           new Promise((_, reject) => 
//             setTimeout(() => reject(new Error('Geocoding timeout')), 5000)
//           )
//         ]);
//         location = geocodeResult[0]?.formattedAddress;
//       } catch (error) {
//         console.warn('Geocoding failed:', error);
//         location = region.location; // Keep existing location on error
//       }

//       // 5. Update region with all new information in a single operation
//       const updatedRegion = await RegionMap.findByIdAndUpdate(
//         regionId,
//         {
//           $set: {
//             centralCoord: centerPoint,
//             boundary: boundary,
//             location: location || 'Unknown Location',
//             updatedAt: new Date()
//           },
//           $addToSet: { markers: markerId },
//           $inc: { markerCount: 1 }
//         },
//         { 
//           new: true, 
//           session,
//           runValidators: true
//         }
//       );

//       if (!updatedRegion) {
//         throw new Error('Failed to update region');
//       }

//       // 6. Mark marker as processed
//       await Marker.findByIdAndUpdate(
//         markerId,
//         { 
//           $set: { 
//             processed: true,
//             updatedAt: new Date()
//           }
//         },
//         { session }
//       );

//       return updatedRegion;

//     } catch (error) {
//       throw new Error(`Region update failed: ${error.message}`);
//     }
// }

//   // Router implementation with rate limiting
//   static getRouter() {
//     const router = express.Router();

//     router.post('/process-markers', apiLimiter, async (req, res) => {
//       try {
//         const service = new RegionMapService();
//         const result = await service.processNewMarkers();
//         res.json(result);
//       } catch (error) {
//         console.error('Error processing markers:', error);
//         res.status(500).json({ 
//           error: 'Internal server error',
//           details: process.env.NODE_ENV === 'development' ? error.message : undefined 
//         });
//       }
//     });

//     router.get('/find-region', apiLimiter, async (req, res) => {
//       try {
//         const { lat, lng } = req.query;
//         if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
//           return res.status(400).json({ error: 'Invalid coordinates' });
//         }

//         const regions = await RegionMap.find({
//           boundary: {
//             $geoIntersects: {
//               $geometry: {
//                 type: 'Point',
//                 coordinates: [parseFloat(lng), parseFloat(lat)]
//               }
//             }
//           }
//         }).select('-markers');  // Exclude markers array for performance

//         res.json(regions);
//       } catch (error) {
//         res.status(500).json({ 
//           error: 'Internal server error',
//           details: process.env.NODE_ENV === 'development' ? error.message : undefined 
//         });
//       }
//     });

//     return router;
//   }
// }









































// //2
// import express from 'express';
// import mongoose from 'mongoose';
// import NodeGeocoder from 'node-geocoder';
// import rateLimit from 'express-rate-limit';

// // Constants for clustering configuration
// const THRESHOLD_DISTANCE = 3000; // meters
// const MIN_CLUSTER_SIZE = 2;
// const GEOCODING_TIMEOUT = 5000;
// const MAX_RETRIES = 3;
// const EPSILON = THRESHOLD_DISTANCE; // For DBSCAN
// const MIN_POINTS = MIN_CLUSTER_SIZE; // For DBSCAN

// // Rate limiter middleware
// const apiLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100 // limit each IP to 100 requests per windowMs
// });

// // Marker Schema
// const markerSchema = new mongoose.Schema({
//   coordinates: {
//     type: {
//       type: String,
//       enum: ['Point'],
//       default: 'Point'
//     },
//     coordinates: {
//       type: [Number],
//       required: true,
//       validate: {
//         validator: function(coords) {
//           return coords.length === 2 && 
//                  coords[1] >= -90 && coords[1] <= 90 && // latitude
//                  coords[0] >= -180 && coords[0] <= 180; // longitude
//         },
//         message: 'Invalid coordinates. Expected [longitude, latitude] format.'
//       }
//     }
//   },
//   processed: { type: Boolean, default: false }
// }, { timestamps: true });

// markerSchema.index({ coordinates: '2dsphere' });
// markerSchema.index({ processed: 1, createdAt: 1 });
// const Marker = mongoose.model('Marker', markerSchema);

// // RegionMap Schema
// const regionMapSchema = new mongoose.Schema({
//   centralCoord: {
//     type: {
//       type: String,
//       enum: ['Point'],
//       default: 'Point'
//     },
//     coordinates: {
//       type: [Number],
//       required: true,
//       validate: {
//         validator: function(coords) {
//           return coords.length === 2 && 
//                  coords[1] >= -90 && coords[1] <= 90 && // latitude
//                  coords[0] >= -180 && coords[0] <= 180; // longitude
//         },
//         message: 'Invalid central coordinates'
//       }
//     }
//   },
//   boundary: {
//     type: {
//       type: String,
//       enum: ['Polygon'],
//       default: 'Polygon'
//     },
//     coordinates: {
//       type: [[[Number]]],
//       required: true,
//       validate: {
//         validator: function(coords) {
//           if (!coords.length || !coords[0].length) return false;
//           return coords[0].every(point => 
//             point.length === 2 &&
//             point[1] >= -90 && point[1] <= 90 &&
//             point[0] >= -180 && point[0] <= 180
//           );
//         },
//         message: 'Invalid boundary coordinates'
//       }
//     }
//   },
//   location: String,
//   markers: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Marker'
//   }],
//   markerCount: { type: Number, default: 0 }
// }, { timestamps: true });

// regionMapSchema.index({ 
//     centralCoord: '2dsphere',
//     boundary: '2dsphere'
//   });
// export const RegionMap = mongoose.model('RegionMap', regionMapSchema);

// // DBSCAN implementation
// function calculateDistance(point1, point2) {
//   const R = 6371000; // Earth's radius in meters
//   const lat1 = point1[1] * Math.PI / 180;
//   const lat2 = point2[1] * Math.PI / 180;
//   const deltaLat = (point2[1] - point1[1]) * Math.PI / 180;
//   const deltaLon = (point2[0] - point1[0]) * Math.PI / 180;

//   const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
//            Math.cos(lat1) * Math.cos(lat2) *
//            Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//   return R * c;
// }

// function getNeighbors(point, points, epsilon) {
//   return points.reduce((neighbors, otherPoint, index) => {
//     if (calculateDistance(point, otherPoint) <= epsilon) {
//       neighbors.push(index);
//     }
//     return neighbors;
//   }, []);
// }

// function dbscan(points, epsilon, minPoints) {
//   const clusters = [];
//   const visited = new Set();
//   const noise = new Set();

//   function expandCluster(point, neighbors, clusterId) {
//     const cluster = [point];
//     let i = 0;
//     while (i < neighbors.length) {
//       const currentPoint = points[neighbors[i]];
//       const currentPointIdx = neighbors[i];

//       if (!visited.has(currentPointIdx)) {
//         visited.add(currentPointIdx);
//         const currentNeighbors = getNeighbors(currentPoint, points, epsilon);
//         if (currentNeighbors.length >= minPoints) {
//           neighbors.push(...currentNeighbors.filter(n => !neighbors.includes(n)));
//         }
//       }

//       if (!clusters.some(c => c.includes(currentPointIdx))) {
//         cluster.push(currentPointIdx);
//       }
//       i++;
//     }
//     return cluster;
//   }

//   points.forEach((point, index) => {
//     if (visited.has(index)) return;
//     visited.add(index);

//     const neighbors = getNeighbors(point, points, epsilon);
//     if (neighbors.length < minPoints) {
//       noise.add(index);
//     } else {
//       const cluster = expandCluster(index, neighbors, clusters.length);
//       clusters.push(cluster);
//     }
//   });

//   return clusters.map(cluster => 
//     cluster.map(idx => points[idx])
//   );
// }

// // RegionMapService class
// export class RegionMapService {
//   constructor() {
//     this.geocoder = NodeGeocoder({
//       provider: 'openstreetmap',
//       timeout: GEOCODING_TIMEOUT
//     });
//   }

//   async reverseGeocode(lat, lng, retryCount = 0) {
//     try {
//       const location = await this.geocoder.reverse({ lat, lon: lng });
//       return location[0]?.formattedAddress || 'Unknown Location';
//     } catch (error) {
//       if (retryCount < MAX_RETRIES) {
//         await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
//         return this.reverseGeocode(lat, lng, retryCount + 1);
//       }
//       console.error('Geocoding failed:', error);
//       return 'Unknown Location';
//     }
//   }

//   async processNewMarkers() {
//     try {
//       const startDate = new Date();
//       startDate.setHours(startDate.getHours() - 24);

//       // Find unprocessed markers with nearby regions
//     //   const markersWithRegions = await Marker.aggregate([
//     //     {
//     //       $match: {
//     //         processed: false,
//     //         createdAt: { $gte: startDate }
//     //       }
//     //     },
//     //     {
//     //       $lookup: {
//     //         from: 'regionmaps',
//     //         let: { markerCoords: '$coordinates.coordinates' },
//     //         pipeline: [
//     //           {
//     //             $geoNear: {
//     //               near: { 
//     //                 type: 'Point',
//     //                 coordinates: '$$markerCoords'
//     //               },
//     //               distanceField: 'distance',
//     //               maxDistance: THRESHOLD_DISTANCE,
//     //               spherical: true
//     //             }
//     //           },
//     //           { $limit: 1 }
//     //         ],
//     //         as: 'nearbyRegions'
//     //       }
//     //     }
//     //   ]);

//         // Find unprocessed markers
//         const unprocessedMarkers = await Marker.find({
//             processed: false,
//             createdAt: { $gte: startDate }
//           });

//         console.log('unprocessedMarkers>>>>', unprocessedMarkers)
    

//       // Find nearby regions for each marker using $geoWithin instead of $geoNear
//       const markersWithRegions = await Promise.all(
//         unprocessedMarkers.map(async (marker) => {
//           const nearbyRegions = await RegionMap.find({
//             boundary: {
//               $geoIntersects: {
//                 $geometry: {
//                   type: 'Point',
//                   coordinates: marker.coordinates.coordinates
//                 }
//               }
//             }
//           }).limit(1);


//           console.log('nearbyRegion calc mapping over unprocessedMarker>> ', nearbyRegions)

//           return {
//             _id: marker._id,
//             coordinates: marker.coordinates,
//             nearbyRegions
//           };
//         })
//       );

//       console.log('markersWithRegions>>>>>>>>>>>>>>.', markersWithRegions)

//       // Process markers near existing regions
//       const updatePromises = markersWithRegions
//         .filter(m => m.nearbyRegions.length > 0)
//         .map(marker => 
//           this.updateRegion(marker.nearbyRegions[0]._id, marker._id)
//         );
      
//       await Promise.all(updatePromises);

//       // Create new clusters from remaining markers
//       const unassignedMarkers = markersWithRegions
//         .filter(m => m.nearbyRegions.length === 0);

//       if (unassignedMarkers.length >= MIN_CLUSTER_SIZE) {
//         const points = unassignedMarkers.map(m => m.coordinates.coordinates);
//         const clusters = dbscan(points, EPSILON, MIN_POINTS);
        
//         for (const cluster of clusters) {
//           if (cluster.length >= MIN_CLUSTER_SIZE) {
//             const clusterMarkerIds = unassignedMarkers
//               .filter(m => 
//                 cluster.some(point => 
//                   point[0] === m.coordinates.coordinates[0] && 
//                   point[1] === m.coordinates.coordinates[1]
//                 )
//               )
//               .map(m => m._id);
            
//             await this.createRegionFromCluster(cluster, clusterMarkerIds);
//           }
//         }
//       }

//       // Mark all processed markers
//       await Marker.updateMany(
//         { _id: { $in: markersWithRegions.map(m => m._id) } },
//         { $set: { processed: true } }
//       );

//       return { 
//         success: true, 
//         processedCount: markersWithRegions.length 
//       };

//     } catch (error) {
//       console.error('Process markers error:', error);
//       throw error;
//     }
//   }

//   async createRegionFromCluster(points, markerIds) {
//     // Calculate center point
//     const centerLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
//     const centerLng = points.reduce((sum, p) => sum + p[0], 0) / points.length;

//     // Create convex hull for boundary
//     const hull = points.reduce((acc, point) => {
//       if (!acc.some(p => p[0] === point[0] && p[1] === point[1])) {
//         acc.push(point);
//       }
//       return acc;
//     }, []);

//     // Ensure hull forms a closed polygon
//     if (hull.length >= 3) {
//       hull.push(hull[0]);
//     } else {
//       // For less than 3 points, create a circle
//       const radius = THRESHOLD_DISTANCE / 2;
//       const numPoints = 32;
//       for (let i = 0; i <= numPoints; i++) {
//         const angle = (2 * Math.PI * i) / numPoints;
//         const dx = radius * Math.cos(angle) / (111320 * Math.cos(centerLat * Math.PI / 180));
//         const dy = radius * Math.sin(angle) / 111320;
//         hull.push([centerLng + dx, centerLat + dy]);
//       }
//     }

//     // Get location name
//     const location = await this.reverseGeocode(centerLat, centerLng);

//     // Create new region
//     const region = new RegionMap({
//       centralCoord: {
//         type: 'Point',
//         coordinates: [centerLng, centerLat]
//       },
//       boundary: {
//         type: 'Polygon',
//         coordinates: [hull]
//       },
//       location,
//       markers: markerIds,
//       markerCount: markerIds.length
//     });

//     await region.save();
//     return region;
//   }

//   async updateRegion(regionId, markerId) {
//   console.log('markerId :', markerId);
//   console.log('regionId :', regionId);

//     if (!mongoose.Types.ObjectId.isValid(regionId) || !mongoose.Types.ObjectId.isValid(markerId)) {
//       throw new Error('Invalid region or marker ID');
//     }

//     const [region, marker] = await Promise.all([
//       RegionMap.findById(regionId),
//       Marker.findById(markerId)
//     ]);

//     if (!region || !marker) {
//       throw new Error('Region or marker not found');
//     }

//     console.log("region in updateRegion>>>>", region)
//     console.log("marker in updateRegion>>>>", marker)

//     try {
//       // Get all marker coordinates including the new one
//       const allMarkers = await Marker.find({
//           _id: { $in: [...region.markers, markerId] }
//         });
//         console.log('allMarkers>>>>>>>>>>>> :', allMarkers);
      
//       const points = allMarkers.map(m => m.coordinates.coordinates);
//       console.log('points>>>>>>>>>> :', points);
      
//       // Calculate new center
//       const centerLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
//       console.log('centerLat :', centerLat);
//       const centerLng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
//       console.log('centerLng :', centerLng);

//       // Create new boundary (similar to createRegionFromCluster)
//       const hull = points.reduce((acc, point) => {
//           if (!acc.some(p => p[0] === point[0] && p[1] === point[1])) {
//               acc.push(point);
//             }
//             return acc;
//         }, []);
        
//         console.log('hull>>>>>>>>>>>>>>>> :', hull);
//       if (hull.length >= 3) {
//         hull.push(hull[0]);
//       } else {
//         const radius = THRESHOLD_DISTANCE / 2;
//         const numPoints = 32;
//         for (let i = 0; i <= numPoints; i++) {
//           const angle = (2 * Math.PI * i) / numPoints;
//           const dx = radius * Math.cos(angle) / (111320 * Math.cos(centerLat * Math.PI / 180));
//           const dy = radius * Math.sin(angle) / 111320;
//           hull.push([centerLng + dx, centerLat + dy]);
//         }
//       }

//       // Get location name
//       const location = await this.reverseGeocode(centerLat, centerLng);
//       console.log('location>>>>>>>>>>> :', location);

//       // Update region
//       const updatedRegion = await RegionMap.findByIdAndUpdate(
//           regionId,
//           {
//               $set: {
//                   centralCoord: {
//                       type: 'Point',
//                       coordinates: [centerLng, centerLat]
//                     },
//                     boundary: {
//                         type: 'Polygon',
//                         coordinates: [hull]
//                     },
//                     location: location || 'Unknown Location'
//                 },
//                 $addToSet: { markers: markerId },
//                 $inc: { markerCount: 1 }
//             },
//             { new: true, runValidators: true }
//         );
        
//         console.log('updatedRegion>>>>>>>>>>>>>>>>>> :', updatedRegion);
//       if (!updatedRegion) {
//         throw new Error('Failed to update region');
//       }

//       // Mark marker as processed
//       const marker = await Marker.findByIdAndUpdate(
//           markerId,
//           { 
//               $set: { 
//                   processed: true
//                 }
//             },
//             { new: true, runValidators: true }
//         );
//         console.log('marker>>>>>>>> :', marker);

//       return updatedRegion;

//     } catch (error) {
//       throw new Error(`Region update failed: ${error.message}`);
//     }
//   }

//   static getRouter() {
//     const router = express.Router();

//     router.post('/process-markers', apiLimiter, async (req, res) => {
//       try {
//         const service = new RegionMapService();
//         const result = await service.processNewMarkers();
//         res.json(result);
//       } catch (error) {
//         console.error('Error processing markers:', error);
//         res.status(500).json({ 
//           error: 'Internal server error',
//           details: process.env.NODE_ENV === 'development' ? error.message : undefined 
//         });
//       }
//     });

//     router.get('/find-region', apiLimiter, async (req, res) => {
//       try {
//         const { lat, lng } = req.query;
//         if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
//           return res.status(400).json({ error: 'Invalid coordinates' });
//         }

//         const regions = await RegionMap.find({
//           boundary: {
//             $geoIntersects: {
//               $geometry: {
//                 type: 'Point',
//                 coordinates: [parseFloat(lng), parseFloat(lat)]
//               }
//             }
//           }
//         }).select('-markers');  // Exclude markers array for performance

//         res.json(regions);
//       } catch (error) {
//         res.status(500).json({ 
//           error: 'Internal server error',
//           details: process.env.NODE_ENV === 'development' ? error.message : undefined 
//         });
//       }
//     });

//     return router;
//   }
// }


















//3


// // utils/clustering.js
// import NodeGeocoder from 'node-geocoder';
// // models/Marker.js
// import mongoose from 'mongoose';
// import { RegionMap } from '../models/Marker.js';
// import { Marker } from '../models/RegionMap.js';


// // Example usage for testing:
// /*
// // Create a new marker
// const marker = await Marker.create({
//   coordinates: {
//     coordinates: [40.7128, -74.0060] // New York City coordinates
//   },
//   name: 'Test Marker',
//   description: 'Test Description'
// });

// // Create a new region
// const region = await RegionMap.create({
//   centralCoord: {
//     coordinates: [40.7128, -74.0060]
//   },
//   boundary: {
//     coordinates: [[
//       [40.7128, -74.0060],
//       [40.7228, -74.0060],
//       [40.7228, -74.0160],
//       [40.7128, -74.0160],
//       [40.7128, -74.0060]  // Close the polygon
//     ]]
//   },
//   location: 'New York City',
//   markers: [marker._id]
// });

// // Find regions containing a point
// const containingRegions = await RegionMap.findContainingPoint([40.7128, -74.0060]);

// // Find nearby markers
// const nearbyMarkers = await Marker.findNearby([40.7128, -74.0060], 1000);
// */

// const THRESHOLD_DISTANCE = 1000; // 1km in meters
// const geocoder = NodeGeocoder({ provider: 'openstreetmap' });

// // Helper function to calculate if a point is near a region
// async function findNearestRegion(markerCoords) {
//   // Find regions where the marker is within THRESHOLD_DISTANCE of the region's center
//   const nearbyRegions = await RegionMap.find({
//     centralCoord: {
//       $nearSphere: {
//         $geometry: {
//           type: "Point",
//           coordinates: markerCoords
//         },
//         $maxDistance: THRESHOLD_DISTANCE
//       }
//     }
//   });
  
//   return nearbyRegions.length > 0 ? nearbyRegions[0] : null;
// }

// // Helper to update region boundaries and metadata
// async function updateRegionBoundaries(regionId, markerId) {
//   const region = await RegionMap.findById(regionId);
//   if (!region) return null;
  
//   // Add new marker to region
//   region.markers.push(markerId);
  
//   // Get all markers in the region
//   const markers = await Marker.find({ _id: { $in: region.markers } });
  
//   // Calculate new center point
//   const centerLat = markers.reduce((sum, m) => sum + m.coordinates.coordinates[0], 0) / markers.length;
//   const centerLng = markers.reduce((sum, m) => sum + m.coordinates.coordinates[1], 0) / markers.length;
  
//   // Create a polygon boundary using the marker points
//   // Here we're using a simple approach - for more precise boundary,
//   // you might want to implement Graham Scan or other convex hull algorithms
//   const sortedPoints = markers.map(m => m.coordinates.coordinates)
//     .sort((a, b) => a[0] - b[0]); // Sort by latitude
  
//   // Create a simple polygon by connecting points
//   const boundary = {
//     type: 'Polygon',
//     coordinates: [
//       [...sortedPoints, sortedPoints[0]] // Close the polygon by adding first point at end
//     ]
//   };
  
//   // Get location name for center point
//   const location = await geocoder.reverse({
//     lat: centerLat,
//     lon: centerLng
//   });
  
//   // Update the region
//   return await RegionMap.findByIdAndUpdate(regionId, {
//     centralCoord: {
//       type: 'Point',
//       coordinates: [centerLat, centerLng]
//     },
//     boundary,
//     location: location[0].formattedAddress,
//     markers: region.markers
//   }, { new: true });
// }

// // Helper to create regions from a cluster of markers
// async function createRegionFromMarkers(markers) {
//   // Calculate center point
//   const centerLat = markers.reduce((sum, m) => sum + m.coordinates.coordinates[0], 0) / markers.length;
//   const centerLng = markers.reduce((sum, m) => sum + m.coordinates.coordinates[1], 0) / markers.length;
  
//   // Create boundary similar to updateRegionBoundaries
//   const sortedPoints = markers.map(m => m.coordinates.coordinates)
//     .sort((a, b) => a[0] - b[0]);
  
//   const boundary = {
//     type: 'Polygon',
//     coordinates: [
//       [...sortedPoints, sortedPoints[0]]
//     ]
//   };
  
//   // Get location name
//   const location = await geocoder.reverse({
//     lat: centerLat,
//     lon: centerLng
//   });
  
//   // Create new region
//   return await RegionMap.create({
//     centralCoord: {
//       type: 'Point',
//       coordinates: [centerLat, centerLng]
//     },
//     boundary,
//     location: location[0].formattedAddress,
//     markers: markers.map(m => m._id)
//   });
// }

// // Main processing function
// export async function processNewMarkers() {
//   try {
//     // Get all markers that aren't in any region
//     const unassignedMarkers = await Marker.find({
//       _id: { 
//         $nin: await RegionMap.distinct('markers')
//       }
//     });
    
//     // Process markers near existing regions
//     const markerUpdates = [];
//     const remainingMarkers = [];
    
//     for (const marker of unassignedMarkers) {
//       const nearestRegion = await findNearestRegion(marker.coordinates.coordinates);
      
//       if (nearestRegion) {
//         markerUpdates.push(updateRegionBoundaries(nearestRegion._id, marker._id));
//       } else {
//         remainingMarkers.push(marker);
//       }
//     }
    
//     // Wait for all region updates to complete
//     await Promise.all(markerUpdates);
    
//     // Process remaining markers into new clusters
//     if (remainingMarkers.length > 0) {
//       // Use MongoDB's $geoNear to find markers close to each other
//       const clusters = await Marker.aggregate([
//         {
//           $match: {
//             _id: { $in: remainingMarkers.map(m => m._id) }
//           }
//         },
//         {
//           $geoNear: {
//             near: remainingMarkers[0].coordinates,
//             distanceField: "distance",
//             maxDistance: THRESHOLD_DISTANCE,
//             spherical: true
//           }
//         },
//         {
//           $group: {
//             _id: "$_id",
//             markers: { $push: "$$ROOT" }
//           }
//         }
//       ]);
      
//       // Create new regions for each cluster
//       await Promise.all(clusters.map(cluster => 
//         createRegionFromMarkers(cluster.markers)
//       ));
//     }
    
//     return { success: true };
//   } catch (error) {
//     console.error('Error processing markers:', error);
//     throw error;
//   }
// }

// // routes/regionMap.js
// import express from 'express';
// import { processNewMarkers } from '../utils/clustering.js';

// const router = express.Router();

// router.post('/process-markers', async (req, res) => {
//   try {
//     const result = await processNewMarkers();
//     res.json(result);
//   } catch (error) {
//     console.error('Error processing markers:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// export default router;















//4
import NodeGeocoder from 'node-geocoder';
// import { Marker } from '../models/Marker.js';
// import { RegionMap } from '../models/RegionMap.js';
import { DBSCAN, grahamScan, Point } from './geometry.js';
import Marker from '../models/Marker.js';
import RegionMap from '../models/RegionMap.js';

const THRESHOLD_DISTANCE = 1000; // 1km in meters
// const THRESHOLD_DISTANCE = 500; // 1km in meters
const MIN_POINTS_FOR_CLUSTER = 3;
const geocoder = NodeGeocoder({ provider: 'openstreetmap' });

// Helper to calculate region boundary using Graham's Scan
// function calculateRegionBoundary(markers) {
//   const points = markers.map(m => new Point(
//     m.coordinates.coordinates[0],
//     m.coordinates.coordinates[1]
//   ));
  
//   const hullPoints = grahamScan(points);
  
//   // Convert hull points to GeoJSON polygon format
//   return {
//     type: 'Polygon',
//     coordinates: [[
//       ...hullPoints.map(p => [p.lat, p.lng]),
//       [hullPoints[0].lat, hullPoints[0].lng] // Close the polygon
//     ]]
//   };
// }
function calculateRegionBoundary(markers) {
  const points = markers.map(m => new Point(
    m.coordinates.coordinates[1],  // Latitude
    m.coordinates.coordinates[0]   // Longitude
  ));
  
  console.log("Points for boundary calculation:", points);

  const hullPoints = grahamScan(points);
  
  console.log("Hull points:", hullPoints);

  return {
    type: 'Polygon',
    coordinates: [[
      ...hullPoints.map(p => [p.lng, p.lat]),  // GeoJSON uses [longitude, latitude]
      [hullPoints[0].lng, hullPoints[0].lat]  // Close the polygon
    ]]
  };
}

async function updateRegionBoundaries(regionId, markerId) {
  const region = await RegionMap.findById(regionId);
  if (!region) return null;
  
  region.markers.push(markerId);
  const markers = await Marker.find({ _id: { $in: region.markers } });
  
  // Calculate center point
  const centerLat = markers.reduce((sum, m) => sum + m.coordinates.coordinates[0], 0) / markers.length;
  const centerLng = markers.reduce((sum, m) => sum + m.coordinates.coordinates[1], 0) / markers.length;
  
  // Calculate boundary using Graham's Scan
  const boundary = calculateRegionBoundary(markers);
  
  // Get location name
  // const location = await geocoder.reverse({
  //   lat: centerLat,
  //   lon: centerLng
  // });
  const location = 'hi!'

  // region.markerCount = region.markers.length;
  
  return await RegionMap.findByIdAndUpdate(regionId, {
    centralCoord: {
      type: 'Point',
      coordinates: [centerLat, centerLng]
    },
    boundary,
    location: location[0].formattedAddress,
    markers: region.markers
  }, { new: true });
}

async function createRegionFromMarkers(markers) {
  const centerLat = markers.reduce((sum, m) => sum + m.coordinates.coordinates[0], 0) / markers.length;
  const centerLng = markers.reduce((sum, m) => sum + m.coordinates.coordinates[1], 0) / markers.length;
  
  // Calculate boundary using Graham's Scan
  const boundary = calculateRegionBoundary(markers);
  
  // const location = await geocoder.reverse({
  //   lat: centerLat,
  //   lon: centerLng
  // });
  const location = 'hello!'
  
  return await RegionMap.create({
    centralCoord: {
      type: 'Point',
      coordinates: [centerLat, centerLng]
    },
    boundary,
    location: location[0].formattedAddress,
    markers: markers.map(m => m._id)
  });
}

export async function processNewMarkers() {
  try {
    // Get unassigned markers
    const unassignedMarkers = await Marker.find({
      _id: { 
        $nin: await RegionMap.distinct('markers')
      }
    });
    console.log("Unassigned markers:", unassignedMarkers.length);
    
    if (unassignedMarkers.length === 0) {
      return { success: true, message: 'No new markers to process' };
    }

    // Initialize DBSCAN
    const dbscan = new DBSCAN(THRESHOLD_DISTANCE, MIN_POINTS_FOR_CLUSTER);
    const { clusters, noise } = dbscan.run(unassignedMarkers);
    console.log("DBSCAN results - Clusters:", clusters.length, "Noise points:", noise.length);
    // Process each cluster into a new region
    const newRegions = await Promise.all(
      clusters.map(cluster => createRegionFromMarkers(cluster))
    );

    // For noise points (outliers), try to assign them to nearest existing regions
    const noiseUpdates = await Promise.all(
      noise.map(async marker => {
        const nearestRegion = await RegionMap.findOne({
          centralCoord: {
            $nearSphere: {
              $geometry: {
                type: "Point",
                coordinates: marker.coordinates.coordinates
              },
              $maxDistance: THRESHOLD_DISTANCE
            }
          }
        });

        if (nearestRegion) {
          return updateRegionBoundaries(nearestRegion._id, marker._id);
        }
        return null;
      })
    );

    // const allRegions = await RegionMap.find()

      // Fetch only the boundary coordinates for all regions
      const allBoundaries = await RegionMap.find().select('boundary.coordinates -_id');
      const regions = allBoundaries.map(region => region.boundary.coordinates[0]);

    return {
      regions,
      success: true,
      newRegions: newRegions.length,
      processedOutliers: noiseUpdates.filter(Boolean).length,
      unprocessedOutliers: noiseUpdates.filter(x => !x).length
    };
    
  } catch (error) {
    console.error('Error processing markers:', error);
    throw error;
  }
}