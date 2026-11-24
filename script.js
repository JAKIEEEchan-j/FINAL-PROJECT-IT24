
let map;
let locationMarker = null;

const DEFAULT_LOCATION = {
    latitude: 14.5995,
    longitude: 120.9842
};

const DEFAULT_ZOOM = 6;

// I-initialize ang interactive map sa Pilipinas.
function initializeMap() {
    const mapElement = document.getElementById("map");

    if (!mapElement) {
        console.error("Map element not found. Check your index.html.");
        return;
    }

    if (typeof L === "undefined") {
        console.error("Leaflet not loaded. Check the Leaflet script in index.html.");
        return;
    }

    map = L.map("map").setView(
        [DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude],
        DEFAULT_ZOOM
    );

    const satelliteMap = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            attribution: "Tiles &copy; Esri",
            maxZoom: 19
        }
    );

    const streetMap = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19
        }
    );

    satelliteMap.addTo(map);

    const baseMaps = {
        "Satellite View": satelliteMap,
        "Street Map": streetMap
    };

    L.control.layers(baseMaps, null, {
        position: "topright",
        collapsed: false
    }).addTo(map);

    updateMapMarker(
        DEFAULT_LOCATION.latitude,
        DEFAULT_LOCATION.longitude,
        "Manila, Philippines"
    );
}

// I-update ang marker ug map location.
function updateMapMarker(latitude, longitude, locationName) {
    if (!map) {
        console.error("Map has not been initialized.");
        return;
    }

    if (locationMarker !== null) {
        map.removeLayer(locationMarker);
    }

    locationMarker = L.marker([
        latitude,
        longitude
    ]).addTo(map);

    const popupContent = document.createElement("strong");
    popupContent.textContent = locationName;

    locationMarker
        .bindPopup(popupContent)
        .openPopup();

    map.flyTo(
        [latitude, longitude],
        12,
        {
            animate: true,
            duration: 1.5
        }
    );
}

// Mangita og lokasyon sulod sa Pilipinas.
async function searchLocation() {
    const searchInput = document.getElementById("location-search");

    if (!searchInput) {
        console.error("Location search input not found.");
        return;
    }

    const locationName = searchInput.value.trim();

    if (locationName === "") {
        alert("Please enter a Philippine location.");
        return;
    }

    try {
        const searchURL =
            `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(locationName)}` +
            `&format=jsonv2` +
            `&countrycodes=ph` +
            `&addressdetails=1` +
            `&limit=1`;

        const response = await fetch(searchURL);

        if (!response.ok) {
            throw new Error("Unable to contact location service.");
        }

        const results = await response.json();

        if (results.length === 0) {
            alert("Location not found. Please search within the Philippines.");
            return;
        }

        const selectedLocation = results[0];

        if (
            !selectedLocation.address ||
            selectedLocation.address.country_code !== "ph"
        ) {
            alert("Only locations within the Philippines are allowed.");
            return;
        }

        const latitude = parseFloat(selectedLocation.lat);
        const longitude = parseFloat(selectedLocation.lon);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            throw new Error("Invalid location coordinates.");
        }

        updateMapMarker(
            latitude,
            longitude,
            selectedLocation.display_name
        );

        console.log("Selected Philippine location:", selectedLocation.display_name);

    } catch (error) {
        console.error("Location search error:", error);

        alert(
            "Something went wrong while searching. " +
            "Please check your internet connection and try again."
        );
    }
}

// I-connect ang search button ug Enter key.
function setupLocationSearch() {
    const searchButton = document.getElementById("search-location");
    const searchInput = document.getElementById("location-search");

    if (!searchButton || !searchInput) {
        console.error("Location search elements were not found.");
        return;
    }

    searchButton.addEventListener("click", searchLocation);

    searchInput.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            searchLocation();
        }
    });
}

// I-set ang theme ug i-save ang preference.
function setupThemeToggle() {
    const themeButton = document.getElementById("theme-toggle");

    if (!themeButton) {
        console.error("Theme button not found.");
        return;
    }

    try {
        const savedTheme = localStorage.getItem("eventcast-theme");

        document.body.classList.toggle(
            "light-mode",
            savedTheme === "light"
        );

        themeButton.addEventListener("click", function() {
            document.body.classList.toggle("light-mode");

            const isLightMode = document.body.classList.contains("light-mode");

            try {
                localStorage.setItem(
                    "eventcast-theme",
                    isLightMode ? "light" : "dark"
                );
            } catch (error) {
                console.error("Unable to save theme preference:", error);
            }
        });

    } catch (error) {
        console.error("Unable to load theme preference:", error);
    }
}

// I-start ang EventCast features.
function initializeEventCast() {
    setupThemeToggle();
    initializeMap();
    setupLocationSearch();

    console.log("EventCast initialized successfully.");
}

document.addEventListener("DOMContentLoaded", initializeEventCast);
