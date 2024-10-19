import mongoose from 'mongoose';

const markerSchema = new mongoose.Schema({
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[1] >= -90 && coords[1] <= 90 && // latitude
                 coords[0] >= -180 && coords[0] <= 180; // longitude
        },
        message: 'Invalid coordinates. Expected [longitude, latitude] format.'
      }
    }
  },
  processed: { type: Boolean, default: false }
}, { timestamps: true });

markerSchema.index({ coordinates: '2dsphere' });
markerSchema.index({ processed: 1, createdAt: 1 });

const Marker = mongoose.model('Marker', markerSchema);
export default Marker;



// // models/RegionMap.js
// const regionMapSchema = new mongoose.Schema({
//   // Central coordinate of the region
//   centralCoord: {
//     type: {
//       type: String,
//       enum: ['Point'],
//       required: true,
//       default: 'Point'
//     },
//     coordinates: {
//       type: [Number],
//       required: true,
//       validate: {
//         validator: function(coords) {
//           return coords.length === 2 && 
//                  coords[0] >= -90 && coords[0] <= 90 && 
//                  coords[1] >= -180 && coords[1] <= 180;
//         },
//         message: 'Invalid central coordinates'
//       }
//     }
//   },
//   // Boundary polygon of the region
//   boundary: {
//     type: {
//       type: String,
//       enum: ['Polygon'],
//       required: true,
//       default: 'Polygon'
//     },
//     coordinates: {
//       type: [[[Number]]], // Array of arrays of coordinates forming the polygon
//       required: true,
//       validate: {
//         validator: function(coords) {
//           if (!coords || !coords.length || !coords[0] || !coords[0].length) {
//             return false;
//           }
//           // Check if polygon is closed (first and last points match)
//           const firstPoint = coords[0][0];
//           const lastPoint = coords[0][coords[0].length - 1];
//           if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
//             return false;
//           }
//           // Validate all coordinates
//           return coords[0].every(point => 
//             point.length === 2 &&
//             point[0] >= -90 && point[0] <= 90 &&
//             point[1] >= -180 && point[1] <= 180
//           );
//         },
//         message: 'Invalid boundary polygon. Must be a closed polygon with valid coordinates.'
//       }
//     }
//   },
//   // Human-readable location name
//   location: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   // References to markers within this region
//   markers: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Marker',
//     required: true
//   }],
//   // Metadata
//   area: {
//     type: Number,
//     min: 0
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Create indexes for geospatial queries
// regionMapSchema.index({ centralCoord: '2dsphere' });
// regionMapSchema.index({ boundary: '2dsphere' });

// // Update timestamps on save
// regionMapSchema.pre('save', function(next) {
//   this.updatedAt = new Date();
//   next();
// });

// // Add method to find regions containing a point
// regionMapSchema.statics.findContainingPoint = function(coords) {
//   return this.find({
//     boundary: {
//       $geoIntersects: {
//         $geometry: {
//           type: 'Point',
//           coordinates: coords
//         }
//       }
//     }
//   });
// };

// // Add method to find nearby regions
// regionMapSchema.statics.findNearby = function(coords, maxDistance) {
//   return this.find({
//     centralCoord: {
//       $nearSphere: {
//         $geometry: {
//           type: 'Point',
//           coordinates: coords
//         },
//         $maxDistance: maxDistance
//       }
//     }
//   });
// };

// // Calculate approximate area of the region in square meters
// regionMapSchema.pre('save', function(next) {
//   if (this.boundary && this.boundary.coordinates && this.boundary.coordinates[0]) {
//     const coordinates = this.boundary.coordinates[0];
//     let area = 0;
    
//     // Use shoelace formula to calculate polygon area
//     for (let i = 0; i < coordinates.length - 1; i++) {
//       const [lat1, lng1] = coordinates[i];
//       const [lat2, lng2] = coordinates[i + 1];
//       area += lat1 * lng2 - lat2 * lng1;
//     }
    
//     this.area = Math.abs(area) * 111319.9 * 111319.9 / 2; // Convert to approximate square meters
//   }
//   next();
// });

// export const RegionMap = mongoose.model('RegionMap', regionMapSchema);
