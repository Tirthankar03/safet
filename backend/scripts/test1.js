//scripts/test1.js
// Example API calls
const API_URL = 'http://localhost:8000/api';

// Process new markers
fetch(`${API_URL}/regions/process-markers`, {
  method: 'POST'
})
.then(response => response.json())
.then(data => console.log('Processed markers:', data));

// Find region for coordinates
fetch(`${API_URL}/regions/find-region?lat=40.7128&lng=-74.0060`)
.then(response => response.json())
.then(data => console.log('Found regions:', data));