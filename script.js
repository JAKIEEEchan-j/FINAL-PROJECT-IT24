let map;
let locationMarker = null;
let openWeatherApiKey = "";
let weatherRequestId = 0;

let currentLocation = {
    latitude: 14.5995,
    longitude: 120.9842,
    name: "Manila, Philippines"
};

const DEFAULT_LOCATION = {
    latitude: 14.5995,
    longitude: 120.9842
};

const DEFAULT_ZOOM = 6;


// I-initialize ang interactive map sa Pilipinas.
function initializeMap() {
    const mapElement = document.getElementById("map");

    if (!mapElement || typeof L === "undefined") {
        console.error("Map element or Leaflet not found.");
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
        currentLocation.latitude,
        currentLocation.longitude,
        currentLocation.name
    );

map.on("click", async function (event) {
    const latitude = event.latlng.lat;
    const longitude = event.latlng.lng;

    try {
        // I-check kung naa ba sulod sa Pilipinas.
        const reverseURL =
            "https://nominatim.openstreetmap.org/reverse?" +
            `lat=${latitude}&lon=${longitude}` +
           "&format=jsonv2&addressdetails=1&namedetails=1";
        const response = await fetch(reverseURL);

        if (!response.ok) {
            throw new Error("Unable to verify map location.");
        }

        const result = await response.json();

        if (!result.address ||
            result.address.country_code !== "ph") {
            alert("Please select a location within the Philippines.");
            return;
        }

        // Gamita ang exact coordinates nga gi-click.
        currentLocation = {
            latitude: latitude,
            longitude: longitude,
           name: getLocationLabel(result)
        };

        updateMapMarker(
            latitude,
            longitude,
            currentLocation.name
        );

        if (openWeatherApiKey) {
            await fetchCurrentWeather(latitude, longitude);
        }

        console.log("Pinned coordinates:", latitude, longitude);

    } catch (error) {
        console.error("Map location error:", error);
        alert("Unable to verify this location. Please try again.");
    }
});

}


// Kuhaon ang mas simple nga location name.
function getReadableLocationName(result) {
    const address = result.address || {};

    const placeName =
        result.name ||
        address.amenity ||
        address.leisure ||
        address.tourism ||
        address.shop ||
        address.building ||
        address.road ||
        address.neighbourhood ||
        address.suburb ||
        address.village ||
        address.town ||
        address.city ||
        address.municipality ||
        "Selected Location";

    const area =
        address.city ||
        address.town ||
        address.municipality ||
        address.village;

    if (area && placeName !== area) {
        return `${placeName}, ${area}`;
    }

    return placeName;
}


// I-update ang marker ug map location.
function updateMapMarker(latitude, longitude, locationName) {
    if (!map) return;

    if (locationMarker !== null) {
        map.removeLayer(locationMarker);
    }

    locationMarker = L.marker([latitude, longitude]).addTo(map);

    const popupContent = document.createElement("strong");
    popupContent.textContent = locationName;

    locationMarker.bindPopup(popupContent).openPopup();

    map.flyTo([latitude, longitude], 12, {
        animate: true,
        duration: 1.5
    });
}



// Mangita og multiple locations sulod sa Pilipinas.
async function searchLocation() {
    const searchInput = document.getElementById("location-search");
    const resultsContainer = document.getElementById("location-results");

    if (!searchInput || !resultsContainer) return;

    const locationName = searchInput.value.trim();

    if (!locationName) {
        alert("Please enter a Philippine location.");
        return;
    }

    resultsContainer.replaceChildren();

    const loadingMessage = document.createElement("p");
    loadingMessage.textContent = "Searching locations...";
    resultsContainer.appendChild(loadingMessage);

    try {
        const searchURL =
            "https://nominatim.openstreetmap.org/search?" +
            `q=${encodeURIComponent(locationName)}` +
            "&format=jsonv2" +
            "&countrycodes=ph" +
            "&addressdetails=1" +
            "&namedetails=1" +
            "&limit=8";

        const response = await fetch(searchURL);

        if (!response.ok) {
            throw new Error("Unable to contact location service.");
        }

        const results = await response.json();

        const philippineResults = results.filter(function (result) {
            return result.address &&
                result.address.country_code === "ph";
        });

        resultsContainer.replaceChildren();

        if (philippineResults.length === 0) {
            const noResults = document.createElement("p");
            noResults.textContent =
                "No matching Philippine locations found.";
            resultsContainer.appendChild(noResults);
            return;
        }

        philippineResults.forEach(function (result) {
            const resultButton = document.createElement("button");

            const readableName = getLocationLabel(result);

            resultButton.type = "button";
            resultButton.className = "location-result-item";
            resultButton.textContent = readableName;
            resultButton.title = result.display_name;

            resultButton.addEventListener("click", async function () {
                await selectSearchResult(result);
                searchInput.value = readableName;
                resultsContainer.replaceChildren();
            });

            resultsContainer.appendChild(resultButton);
        });

    } catch (error) {
        console.error("Location search error:", error);

        resultsContainer.replaceChildren();

        const errorMessage = document.createElement("p");
        errorMessage.textContent =
            "Search failed. Please check your internet connection.";

        resultsContainer.appendChild(errorMessage);
    }
}


 // I-select ang gipiling search result.
async function selectSearchResult(selectedLocation) {
    const latitude = parseFloat(selectedLocation.lat);
    const longitude = parseFloat(selectedLocation.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        alert("Invalid location coordinates.");
        return;
    }

    currentLocation = {
        latitude,
        longitude,
        name: getLocationLabel(selectedLocation)
    };

    updateMapMarker(
        latitude,
        longitude,
        currentLocation.name
    );

    if (openWeatherApiKey) {
        await fetchCurrentWeather(latitude, longitude);
    }

    console.log("Selected Philippine location:", currentLocation.name);
}



// I-connect ang search button ug Enter key.
function setupLocationSearch() {
    const searchButton = document.getElementById("search-location");
    const searchInput = document.getElementById("location-search");

    if (!searchButton || !searchInput) return;

    searchButton.addEventListener("click", searchLocation);

    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            searchLocation();
        }
    });
}

// I-set ang theme ug i-save ang preference.
function setupThemeToggle() {
    const themeButton = document.getElementById("theme-toggle");

    if (!themeButton) return;

    try {
        const savedTheme = localStorage.getItem("eventcast-theme");

        document.body.classList.toggle(
            "light-mode",
            savedTheme === "light"
        );

        themeButton.addEventListener("click", function () {
            document.body.classList.toggle("light-mode");

            const isLightMode =
                document.body.classList.contains("light-mode");

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

// Ibalhin ang user sa gipiling page.
function navigateToPage(pageName) {
    const pageTitles = {
        dashboard: ["Dashboard", "Welcome to your EventCast dashboard."],
        weather: ["Weather", "Monitor Philippine weather conditions."],
        locations: ["Locations", "Manage your monitored locations."],
        "plan-event": ["Plan Event", "Plan safer outdoor events."],
        "my-events": ["My Events", "View and manage your saved events."],
        alerts: ["Weather Alerts", "Check weather warnings and recommendations."],
        "api-key": ["API Key", "Connect your OpenWeather API key."],
        settings: ["Settings", "Manage your EventCast preferences."]
    };

    if (!pageTitles[pageName]) {
        pageName = "dashboard";
    }

    document.querySelectorAll(".page-view").forEach(function (view) {
        view.hidden = view.id !== `${pageName}-view`;
    });

    document.querySelectorAll("#main-navigation a").forEach(function (link) {
        const isActive = link.dataset.page === pageName;

        link.classList.toggle("active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });

    document.getElementById("page-title").textContent =
        pageTitles[pageName][0];

    document.getElementById("page-description").textContent =
        pageTitles[pageName][1];

    if (pageName === "dashboard" && map) {
        setTimeout(function () {
            map.invalidateSize();
        }, 100);
    }
}

// I-setup ang SPA navigation.
function setupNavigation() {
    const navigation = document.getElementById("main-navigation");

    if (!navigation) return;

    navigation.addEventListener("click", function (event) {
        const link = event.target.closest("a[data-page]");

        if (!link) return;

        event.preventDefault();

        const pageName = link.dataset.page;

        if (window.location.hash !== `#${pageName}`) {
            window.location.hash = pageName;
        } else {
            navigateToPage(pageName);
        }
    });

    window.addEventListener("hashchange", function () {
        const pageName = window.location.hash.substring(1);
        navigateToPage(pageName);
    });

    const initialPage = window.location.hash.substring(1) || "dashboard";

    navigateToPage(initialPage);
}

// I-update ang API connection status.
function updateApiStatus(connected, message) {
    const indicator = document.getElementById("status-indicator");
    const status = document.getElementById("api-status");
    const messageElement = document.getElementById("api-message");

    if (indicator) {
        indicator.classList.toggle("connected", connected);
    }

    if (status) {
        status.textContent = connected ? "Connected" : "Not connected";
    }

    if (messageElement && message) {
        messageElement.textContent = message;
    }
}

// Ikuha ang current weather sa selected location.
async function fetchCurrentWeather(latitude, longitude) {
    if (!openWeatherApiKey) return false;

    const requestId = ++weatherRequestId;

    const temperature = document.getElementById("current-temperature");
    const description = document.getElementById("weather-description");
    const location = document.getElementById("weather-location");
    const icon = document.getElementById("weather-icon");

    if (description) {
        description.textContent = "Loading weather...";
    }

    const weatherURL =
        "https://api.openweathermap.org/data/2.5/weather?" +
        `lat=${latitude}&lon=${longitude}` +
        `&appid=${openWeatherApiKey}&units=metric`;

    try {
        const response = await fetch(weatherURL);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to get weather data.");
        }

        // Ayaw tugoti ang old request nga mo-update sa dashboard.
        if (requestId !== weatherRequestId) {
            return false;
        }

        if (!data.main || !data.weather || !data.weather[0]) {
            throw new Error("Invalid weather data received.");
        }

        if (temperature) {
            temperature.textContent = `${Math.round(data.main.temp)}°C`;
        }

        if (description) {
            description.textContent = data.weather[0].description;
        }

        if (location) {
            location.textContent = currentLocation.name;
        }

        if (icon) {
            const weatherIcons = {
                Clear: "☀️",
                Clouds: "☁️",
                Rain: "🌧️",
                Drizzle: "🌦️",
                Thunderstorm: "⛈️",
                Snow: "❄️",
                Mist: "🌫️",
                Fog: "🌫️",
                Haze: "🌫️"
            };

            icon.textContent =
                weatherIcons[data.weather[0].main] || "🌤️";
        }

        return true;

    } catch (error) {
        console.error("Weather error:", error);

        if (requestId === weatherRequestId) {
            if (description) {
                description.textContent = "Weather unavailable";
            }

            if (icon) {
                icon.textContent = "⚠️";
            }

            if (location) {
                location.textContent = currentLocation.name;
            }
        }

        return false;
    }
}


// I-test ug i-connect ang OpenWeather API.
async function connectOpenWeatherApi() {
    const apiInput = document.getElementById("api-key-input");
    const connectButton = document.getElementById("connect-api");

    if (!apiInput || !connectButton) return;

    const enteredKey = apiInput.value.trim();

    if (!enteredKey) {
        updateApiStatus(false, "Please enter your OpenWeather API key.");
        return;
    }

    connectButton.disabled = true;
    connectButton.textContent = "Connecting...";

    const previousKey = openWeatherApiKey;
    openWeatherApiKey = enteredKey;

    try {
        const success = await fetchCurrentWeather(
            DEFAULT_LOCATION.latitude,
            DEFAULT_LOCATION.longitude
        );

        if (!success) {
            throw new Error("Unable to verify API key.");
        }

        updateApiStatus(
            true,
            "OpenWeather API connected successfully. Test location: Manila."
        );

        apiInput.value = "";

    } catch (error) {
        openWeatherApiKey = previousKey;

        updateApiStatus(
            false,
            "Connection failed. Please check your API key and try again."
        );

        console.error("API connection error:", error);

    } finally {
        connectButton.disabled = false;
        connectButton.textContent = "Connect API";
    }
}

// I-start ang EventCast features.
function initializeEventCast() {
    setupThemeToggle();
    initializeMap();
    setupLocationSearch();
    setupLocationSearchClear();
    setupNavigation();
    setupApiKey();

    console.log("EventCast initialized successfully.");
}


// I-connect ang API Key buttons.
function setupApiKey() {
    const apiKeyInput = document.getElementById("api-key-input");
    const toggleButton = document.getElementById("toggle-api-key");
    const connectButton = document.getElementById("connect-api");

    if (!apiKeyInput || !toggleButton || !connectButton) {
        console.error("API Key elements not found.");
        return;
    }

    toggleButton.addEventListener("click", function () {
        const isPassword = apiKeyInput.type === "password";

        apiKeyInput.type = isPassword ? "text" : "password";
        toggleButton.textContent = isPassword ? "Hide" : "Show";
    });

    connectButton.addEventListener("click", connectOpenWeatherApi);

    apiKeyInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            connectOpenWeatherApi();
        }
    });
}

document.addEventListener("DOMContentLoaded", initializeEventCast);


function setupLocationSearchClear() {
    const searchInput = document.getElementById("location-search");
    const clearButton = document.getElementById("clear-location-search");
    const resultsContainer = document.getElementById("location-results");

    if (!searchInput || !clearButton || !resultsContainer) return;

    clearButton.addEventListener("click", function () {
        searchInput.value = "";
        resultsContainer.replaceChildren();
        searchInput.focus();
    });
}


// Kuhaon ang readable name sa location.
function getLocationLabel(result) {
    const address = result.address || {};

    const placeName =
        result.namedetails?.name ||
        result.name ||
        address.amenity ||
        address.leisure ||
        address.tourism ||
        address.shop ||
        address.building ||
        address.road ||
        address.neighbourhood ||
        address.suburb ||
        address.village ||
        address.town ||
        address.city ||
        address.municipality ||
        "Selected Location";

    const area =
        address.city ||
        address.town ||
        address.municipality ||
        address.village ||
        address.suburb;

    if (area && placeName.toLowerCase() !== area.toLowerCase()) {
        return `${placeName}, ${area}`;
    }

    return placeName;
}
