export class Point {
    constructor(lat, lng) {
      this.lat = lat;
      this.lng = lng;
    }
  
    // Calculate cross product to determine turn direction
    static cross(p1, p2, p3) {
      return (p2.lng - p1.lng) * (p3.lat - p1.lat) - 
             (p2.lat - p1.lat) * (p3.lng - p1.lng);
    }
  
    // Calculate squared distance between two points
    static squaredDistance(p1, p2) {
      return Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2);
    }
  
    // Calculate haversine distance in meters
    static haversineDistance(p1, p2) {
      const R = 6371000; // Earth's radius in meters
      const φ1 = p1.lat * Math.PI / 180;
      const φ2 = p2.lat * Math.PI / 180;
      const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
      const Δλ = (p2.lng - p1.lng) * Math.PI / 180;
  
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }
  }
  
  // Graham's Scan implementation for convex hull
 export function grahamScan(points) {
    if (points.length < 3) return points;
  
    // Find point with lowest y-coordinate (and leftmost if tied)
    let bottomPoint = points[0];
    for (let i = 1; i < points.length; i++) {
      if (points[i].lat < bottomPoint.lat || 
         (points[i].lat === bottomPoint.lat && points[i].lng < bottomPoint.lng)) {
        bottomPoint = points[i];
      }
    }
  
    // Sort points by polar angle with respect to base point
    const sortedPoints = points
      .filter(p => p !== bottomPoint)
      .sort((a, b) => {
        const cross = Point.cross(bottomPoint, a, b);
        if (cross === 0) {
          return Point.squaredDistance(bottomPoint, a) - 
                 Point.squaredDistance(bottomPoint, b);
        }
        return -cross;
      });
  
    // Initialize stack with first three points
    const stack = [bottomPoint];
    for (const point of sortedPoints) {
      while (stack.length > 1 && 
             Point.cross(stack[stack.length-2], stack[stack.length-1], point) <= 0) {
        stack.pop();
      }
      stack.push(point);
    }
  
    return stack;
  }
  
  // DBSCAN implementation
export class DBSCAN {
    constructor(eps = 1000, minPts = 3) { // eps in meters, minPts = minimum points for core point
      this.eps = eps;
      this.minPts = minPts;
      this.clusters = [];
    }
  
    run(points) {
      this.points = points.map((p, i) => ({
        lat: p.coordinates.coordinates[1],
        lng: p.coordinates.coordinates[0],
        visited: false,
        noise: false,
        clusterId: undefined,
        originalPoint: p
      }));
      console.log("Total points:", this.points.length);
      let clusterId = 0;
      
      for (const point of this.points) {
        if (point.visited) continue;
        
        point.visited = true;
        const neighbors = this._getNeighbors(point);
        console.log(`Point (${point.lat}, ${point.lng}) has ${neighbors.length} neighbors`);
        if (neighbors.length < this.minPts) {
          point.noise = true;
          console.log(`Point (${point.lat}, ${point.lng}) marked as noise`);
        } else {
          this._expandCluster(point, neighbors, clusterId);
          clusterId++;
        }
      }
      console.log(`DBSCAN found ${clusterId} clusters`);
  
      // Convert clusters to array format
      return this._getClusters();
    }
  
    _expandCluster(point, neighbors, clusterId) {
      point.clusterId = clusterId;
      
      for (let i = 0; i < neighbors.length; i++) {
        const neighbor = neighbors[i];
        
        if (!neighbor.visited) {
          neighbor.visited = true;
          const newNeighbors = this._getNeighbors(neighbor);
          
          if (newNeighbors.length >= this.minPts) {
            neighbors.push(...newNeighbors.filter(n => !neighbors.includes(n)));
          }
        }
        
        if (neighbor.clusterId === undefined) {
          neighbor.clusterId = clusterId;
        }
      }
    }
  
    // _getNeighbors(point) {
    //   return this.points.filter(p => 
    //     p !== point && 
    //     Point.haversineDistance(point, p) <= this.eps
    //   );
    // }
    _getNeighbors(point) {
      return this.points.filter(p => {
        if (p === point) return false;
        const distance = Point.haversineDistance(point, p);
        console.log(`Distance between (${point.lat}, ${point.lng}) and (${p.lat}, ${p.lng}): ${distance} meters`);
        return distance <= this.eps;
      });
    }
  
    _getClusters() {
      const clusters = [];
      const noise = [];
  
      for (const point of this.points) {
        if (point.noise) {
          noise.push(point.originalPoint);
        } else {
          if (!clusters[point.clusterId]) {
            clusters[point.clusterId] = [];
          }
          clusters[point.clusterId].push(point.originalPoint);
        }
      }
  
      return {
        clusters: clusters.filter(Boolean),
        noise
      };
    }
  }