import NodeGeocoder from 'node-geocoder';
import mongoose from 'mongoose';
import Marker from '../models/Marker.js';
import RegionMap from '../models/RegionMap.js';

const THRESHOLD_DISTANCE = 1000; // meters
const MIN_CLUSTER_SIZE = 2;
const GEOCODING_TIMEOUT = 5000;
const MAX_RETRIES = 3;

class RegionMapService {
  // constructor() {
  //   this.geocoder = NodeGeocoder({
  //     provider: 'openstreetmap',
  //     timeout: GEOCODING_TIMEOUT
  //   });
  // }

  async reverseGeocode(lat, lng, retryCount = 0) {
    try {
      const location = 'unknown location'
      return location
      // const location = await this.geocoder.reverse({ lat, lon: lng });
      // return location[0]?.formattedAddress || 'Unknown Location';
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.reverseGeocode(lat, lng, retryCount + 1);
      }
      console.error('Geocoding failed:', error);
      return 'Unknown Location';
    }
  }

  async processNewMarkers() {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 24);

      // Combined aggregation pipeline for efficiency
      const markersWithRegions = await Marker.aggregate([
        {
          $match: {
            processed: false,
            createdAt: { $gte: startDate }
          }
        },
        {
          $lookup: {
            from: 'regionmaps',
            let: { markerCoords: '$coordinates' },
            pipeline: [
              {
                $geoNear: {
                  near: '$$markerCoords',
                  distanceField: 'distance',
                  maxDistance: THRESHOLD_DISTANCE,
                  spherical: true
                }
              },
              { $limit: 1 }
            ],
            as: 'nearbyRegions'
          }
        }
      ]).session(session);

      // Process markers near existing regions
      const updatePromises = markersWithRegions
        .filter(m => m.nearbyRegions.length > 0)
        .map(marker => 
          this.updateRegion(marker.nearbyRegions[0]._id, marker._id, session)
        );
      
      await Promise.all(updatePromises);

      // Create new clusters from remaining markers
      const unassignedMarkers = markersWithRegions
        .filter(m => m.nearbyRegions.length === 0)
        .map(m => m._id);

      if (unassignedMarkers.length >= MIN_CLUSTER_SIZE) {
        await this.createClusters(unassignedMarkers, session);
      }

      // Mark all processed markers
      await Marker.updateMany(
        { _id: { $in: markersWithRegions.map(m => m._id) } },
        { $set: { processed: true } },
        { session }
      );

      await session.commitTransaction();
      return { success: true, processedCount: markersWithRegions.length };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async createClusters(markerIds, session) {
    const clusters = await Marker.aggregate([
      {
        $match: { _id: { $in: markerIds } }
      },
      {
        $group: {
          _id: null,
          coordinates: { $push: '$coordinates.coordinates' }
        }
      },
      {
        $project: {
          clusters: {
            $function: {
              body: function(coords) {
                // Implementation of DBSCAN clustering algorithm
                // This is a placeholder - you would implement actual DBSCAN here
                return [coords];
              },
              args: ['$coordinates'],
              lang: 'js'
            }
          }
        }
      }
    ]).session(session);

    for (const cluster of clusters[0].clusters) {
      if (cluster.length >= MIN_CLUSTER_SIZE) {
        await this.createRegionFromCluster(cluster, markerIds, session);
      }
    }
  }

  async updateRegion(regionId, markerId, session) {
    // 1. Validate inputs
    if (!mongoose.Types.ObjectId.isValid(regionId) || !mongoose.Types.ObjectId.isValid(markerId)) {
      throw new Error('Invalid region or marker ID');
    }

    // 2. Find region and marker in a single operation
    const [region, marker] = await Promise.all([
      RegionMap.findById(regionId).session(session),
      Marker.findById(markerId).session(session)
    ]);

    if (!region || !marker) {
      throw new Error('Region or marker not found');
    }

    try {
      // 3. Calculate new boundary and center in a single aggregation pipeline
      const [aggregationResult] = await RegionMap.aggregate([
        {
          $match: { _id: region._id }
        },
        {
          $project: {
            allMarkers: { 
              $concatArrays: ['$markers', [markerId]]
            }
          }
        },
        {
          $lookup: {
            from: 'markers',
            let: { markerIds: '$allMarkers' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$_id', '$$markerIds'] }
                }
              },
              {
                $group: {
                  _id: null,
                  coordinates: { $push: '$coordinates.coordinates' },
                  centerLat: { $avg: { $arrayElemAt: ['$coordinates.coordinates', 1] } },
                  centerLng: { $avg: { $arrayElemAt: ['$coordinates.coordinates', 0] } }
                }
              },
              {
                $project: {
                  coordinates: 1,
                  centerPoint: {
                    type: 'Point',
                    coordinates: ['$centerLng', '$centerLat']
                  },
                  boundary: {
                    $cond: {
                      if: { $gte: [{ $size: '$coordinates' }, 3] },
                      then: {
                        type: 'Polygon',
                        coordinates: [{
                          $concatArrays: [
                            { $concaveHull: { 
                              points: '$coordinates',
                              distanceMultiplier: 6371000 // Earth's radius in meters
                            }},
                            [{ $arrayElemAt: [
                              { $concaveHull: { 
                                points: '$coordinates',
                                distanceMultiplier: 6371000
                              }}, 
                              0
                            ]}] // Close the polygon
                          ]
                        }]
                      },
                      else: {
                        // For 2 points or less, create a small circle around the center
                        $geoNearSphere: {
                          center: '$centerPoint',
                          radius: 100 // meters
                        }
                      }
                    }
                  }
                }
              }
            ],
            as: 'calculated'
          }
        },
        { $unwind: '$calculated' }
      ]).session(session);

      if (!aggregationResult) {
        throw new Error('Failed to calculate new region properties');
      }

      const { centerPoint, boundary } = aggregationResult.calculated;

      // 4. Get location name with retry and timeout
      // let location;
      // try {
      //   const geocodeResult = await Promise.race([
      //     this.geocoder.reverse({
      //       lat: centerPoint.coordinates[1],
      //       lon: centerPoint.coordinates[0]
      //     }),
      //     new Promise((_, reject) => 
      //       setTimeout(() => reject(new Error('Geocoding timeout')), 5000)
      //     )
      //   ]);
      //   location = geocodeResult[0]?.formattedAddress;
      // } catch (error) {
      //   console.warn('Geocoding failed:', error);
      //   location = region.location; // Keep existing location on error
      // }

      // 5. Update region with all new information in a single operation
      const updatedRegion = await RegionMap.findByIdAndUpdate(
        regionId,
        {
          $set: {
            centralCoord: centerPoint,
            boundary: boundary,
            location: location || 'Unknown Location',
            // location: location || 'Unknown Location',
            updatedAt: new Date()
          },
          $addToSet: { markers: markerId },
          $inc: { markerCount: 1 }
        },
        { 
          new: true, 
          session,
          runValidators: true
        }
      );

      if (!updatedRegion) {
        throw new Error('Failed to update region');
      }

      // 6. Mark marker as processed
      await Marker.findByIdAndUpdate(
        markerId,
        { 
          $set: { 
            processed: true,
            updatedAt: new Date()
          }
        },
        { session }
      );

      return updatedRegion;

    } catch (error) {
      throw new Error(`Region update failed: ${error.message}`);
    }
}
  // Other service methods...


  static async createRegionFromCluster(cluster, session) {
    // Calculate center point
    const centerPoint = {
      type: 'Point',
      coordinates: [
        cluster.markers.reduce((sum, m) => sum + m.coordinates.coordinates[0], 0) / cluster.markers.length,
        cluster.markers.reduce((sum, m) => sum + m.coordinates.coordinates[1], 0) / cluster.markers.length
      ]
    };

    // Create boundary polygon
    const boundaryPoints = await Marker.aggregate([
      {
        $match: {
          _id: { $in: cluster.markers.map(m => m._id) }
        }
      },
      {
        $group: {
          _id: null,
          coordinates: { $push: '$coordinates.coordinates' }
        }
      },
      {
        $project: {
          boundary: {
            $concaveHull: {
              points: '$coordinates',
              distanceMultiplier: 6371000
            }
          }
        }
      }
    ]).session(session);
  }
}

export default RegionMapService;
