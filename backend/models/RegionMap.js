import mongoose from 'mongoose';

const regionMapSchema = new mongoose.Schema({
  centralCoord: {
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
        message: 'Invalid central coordinates'
      }
    }
  },
  boundary: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon'
    },
    coordinates: {
      type: [[[Number]]],
      required: true,
      validate: {
        validator: function(coords) {
          if (!coords.length || !coords[0].length) return false;
          return coords[0].every(point => 
            point.length === 2 &&
            point[1] >= -90 && point[1] <= 90 &&
            point[0] >= -180 && point[0] <= 180
          );
        },
        message: 'Invalid boundary coordinates'
      }
    }
  },
  location: String,
  markers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Marker'
  }],
  markerCount: { type: Number, default: 0 }
}, { timestamps: true });

regionMapSchema.index({ centralCoord: '2dsphere' });
regionMapSchema.index({ boundary: '2dsphere' });

const RegionMap = mongoose.model('RegionMap', regionMapSchema);
export default RegionMap;




// const markerSchema = new mongoose.Schema({
//   coordinates: {
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
//           // Validate that coordinates are [latitude, longitude]
//           // latitude: -90 to 90, longitude: -180 to 180
//           return coords.length === 2 && 
//                  coords[0] >= -90 && coords[0] <= 90 && 
//                  coords[1] >= -180 && coords[1] <= 180;
//         },
//         message: 'Invalid coordinates. Must be [latitude, longitude] within valid ranges.'
//       }
//     }
//   },
//   // Add any additional marker properties you need
//   name: String,
//   description: String,
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Create a 2dsphere index for geospatial queries
// markerSchema.index({ coordinates: '2dsphere' });

// // Add a method to get markers within a certain distance
// markerSchema.statics.findNearby = function(coords, maxDistance) {
//   return this.find({
//     coordinates: {
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

// // Create virtual property for formatted location
// markerSchema.virtual('formattedLocation').get(function() {
//   const [lat, lng] = this.coordinates.coordinates;
//   return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
// });

// export const Marker = mongoose.model('Marker', markerSchema);
