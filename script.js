var map = L.map('map').setView([51.505, -0.09], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var markers = [];

var geocoder = L.Control.geocoder({
    collapsed: false,
    defaultMarkGeocode: false
}).addTo(map);

function addMarker(location, address, status) {
    var markerColor = status === 'done' ? 'green' : 'red';
    var marker = L.marker(location, {
        icon: L.icon({
            iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${markerColor}.png`,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map)
        .bindPopup('<b>' + address + '</b><br>Status: ' + status).openPopup();
    markers.push({ marker, address, status });
}

function addJobLocationWithStatus(address, status) {
    geocoder.options.geocoder.geocode(address, function(results) {
        if (results.length > 0) {
            var location = results[0].center;
            addMarker(location, address, status);
        } else {
            console.error('Geocoding was not successful for address:', address);
        }
    });
}

function calculateTotalDistance(route) {
    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
        totalDistance += route[i].getLatLng().distanceTo(route[i + 1].getLatLng());
    }
    totalDistance += route[route.length - 1].getLatLng().distanceTo(route[0].getLatLng());
    return totalDistance;
}

function findShortestRoute(markers) {
    let shortestRoute = markers.slice();
    let minDistance = calculateTotalDistance(shortestRoute);

    function permute(arr, callback) {
        function swap(a, b) {
            let tmp = arr[a];
            arr[a] = arr[b];
            arr[b] = tmp;
        }

        function generate(n) {
            if (n === 1) {
                callback(arr.slice());
            } else {
                for (let i = 0; i < n - 1; i++) {
                    generate(n - 1);
                    swap(n % 2 ? 0 : i, n - 1);
                }
                generate(n - 1);
            }
        }

        generate(arr.length);
    }

    permute(markers, function(route) {
        let distance = calculateTotalDistance(route);
        if (distance < minDistance) {
            minDistance = distance;
            shortestRoute = route.slice();
        }
    });

    return shortestRoute;
}

function getCurrentLocation(callback) {
    var currentLocationInput = document.getElementById('current-location-input').value;
    if (currentLocationInput) {
        geocoder.options.geocoder.geocode(currentLocationInput, function(results) {
            if (results.length > 0) {
                var currentLatLng = results[0].center;
                callback(currentLatLng);
            } else {
                console.error('Geocoding failed for current location:', currentLocationInput);
                callback(null);
            }
        });
    } else {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                var currentLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
                callback(currentLatLng);
            }, function(error) {
                console.error('Error getting current location:', error.message);
                callback(null);
            });
        } else {
            console.error('Geolocation is not supported by this browser.');
            callback(null);
        }
    }
}

function calculateDistance(point1, point2) {
    return point1.distanceTo(point2);
}

function findNearestNeighbor(marker, markers) {
    let minDistance = Infinity;
    let nearestMarker = null;

    markers.forEach(function(otherMarker) {
        if (marker !== otherMarker.marker) {
            let distance = calculateDistance(marker.getLatLng(), otherMarker.marker.getLatLng());
            if (distance < minDistance) {
                minDistance = distance;
                nearestMarker = otherMarker.marker;
            }
        }
    });

    return nearestMarker;
}

function findShortestRouteGreedy(markers, currentLatLng) {
    let currentMarker = markers.find(marker => marker.getLatLng().equals(currentLatLng));

    if (!currentMarker) {
        console.error('Current location marker not found in markers array.');
        return null;
    }

    let remainingMarkers = markers.slice();
    let shortestRoute = [currentMarker];
    remainingMarkers.splice(remainingMarkers.indexOf(currentMarker), 1);

    while (remainingMarkers.length > 0) {
        let nearestMarker = findNearestNeighbor(shortestRoute[shortestRoute.length - 1], remainingMarkers);
        shortestRoute.push(nearestMarker);
        remainingMarkers.splice(remainingMarkers.indexOf(nearestMarker), 1);
    }

    return shortestRoute;
}

function planTripGreedy() {
    map.eachLayer(function (layer) {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    getCurrentLocation(function(currentLatLng) {
        if (!currentLatLng) {
            console.error('Failed to get current location.');
            return;
        }

        var currentLocationMarker = L.marker(currentLatLng);
        markers.unshift(currentLocationMarker);

        let shortestRoute = findShortestRouteGreedy(markers, currentLatLng);
        if (!shortestRoute) {
            console.error('Failed to find the shortest route.');
            return;
        }

        let routeCoordinates = shortestRoute.map(marker => marker.getLatLng());
        let routePolyline = L.polyline(routeCoordinates, { color: 'blue' }).addTo(map);
        map.fitBounds(routePolyline.getBounds());
    });
}

function toggleMarkerStatus(marker) {
    var currentStatus = marker.marker.options.status;
    var newStatus = currentStatus === 'done' ? 'not done' : 'done';
    marker.marker.options.status = newStatus;
    var markerColor = newStatus === 'done' ? 'green' : 'red';
    var markerIconUrl = `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${markerColor}.png`;
    marker.marker.setIcon(L.icon({ iconUrl: markerIconUrl }));
    marker.marker.getPopup().setContent(`<b>${marker.address}</b><br>Status: ${newStatus}`).update();
}

map.on('click', function(e) {
    markers.forEach(function(marker) {
        var markerPosition = marker.marker.getLatLng();
        var clickPosition = e.latlng;
        var distance = markerPosition.distanceTo(clickPosition);
        var threshold = 500; // Adjust this value as needed
        if (distance <= threshold) {
            toggleMarkerStatus(marker);
        }
    });
});

document.getElementById('add-marker-btn').addEventListener('click', function () {
    var address = document.getElementById('address-input').value;
    var status = 'not done';
    addJobLocationWithStatus(address, status);
});

document.getElementById('plan-trip-btn').addEventListener('click', function() {
    planTripGreedy();
});