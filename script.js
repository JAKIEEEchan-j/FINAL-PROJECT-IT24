let map;
let locationMarker = null;
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

            await fetchCurrentWeather(latitude, longitude);

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

    await fetchCurrentWeather(latitude, longitude);

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


// I-translate ang Open-Meteo weather code ngadto sa readable condition.
function getWeatherInfo(code) {
    const weatherConditions = {
        0: ["Clear sky", "☀️"],
        1: ["Mainly clear", "🌤️"],
        2: ["Partly cloudy", "⛅"],
        3: ["Overcast", "☁️"],
        45: ["Fog", "🌫️"],
        48: ["Depositing rime fog", "🌫️"],
        51: ["Light drizzle", "🌦️"],
        53: ["Moderate drizzle", "🌦️"],
        55: ["Dense drizzle", "🌧️"],
        56: ["Light freezing drizzle", "🌧️"],
        57: ["Dense freezing drizzle", "🌧️"],
        61: ["Slight rain", "🌦️"],
        63: ["Moderate rain", "🌧️"],
        65: ["Heavy rain", "🌧️"],
        66: ["Light freezing rain", "🌧️"],
        67: ["Heavy freezing rain", "🌧️"],
        71: ["Slight snowfall", "🌨️"],
        73: ["Moderate snowfall", "🌨️"],
        75: ["Heavy snowfall", "❄️"],
        77: ["Snow grains", "🌨️"],
        80: ["Slight rain showers", "🌦️"],
        81: ["Moderate rain showers", "🌧️"],
        82: ["Violent rain showers", "⛈️"],
        85: ["Slight snow showers", "🌨️"],
        86: ["Heavy snow showers", "❄️"],
        95: ["Thunderstorm", "⛈️"],
        96: ["Thunderstorm with slight hail", "⛈️"],
        99: ["Thunderstorm with heavy hail", "⛈️"]
    };

    return weatherConditions[code] || ["Weather condition unavailable", "🌤️"];
}



// Ipakita ang 7-day forecast.
function renderForecast(dailyData) {
    const forecastList = document.getElementById("forecast-list");

    if (!forecastList || !dailyData || !Array.isArray(dailyData.time)) {
        return;
    }

    forecastList.replaceChildren();

    dailyData.time.forEach(function (date, index) {
        const [description] = getWeatherInfo(dailyData.weather_code[index]);

        const forecastCard = document.createElement("article");
        forecastCard.className = "forecast-card";

        const dateElement = document.createElement("p");
        dateElement.className = "forecast-date";

        const parsedDate = new Date(`${date}T00:00:00+08:00`);

        dateElement.textContent = index === 0
            ? "Today"
            : new Intl.DateTimeFormat("en-PH", {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone: "Asia/Manila"
            }).format(parsedDate);

        const iconElement = document.createElement("span");
        iconElement.className = "forecast-icon";
        iconElement.innerHTML = getWeatherIcon(dailyData.weather_code[index]);

        const conditionElement = document.createElement("p");
        conditionElement.className = "forecast-condition";
        conditionElement.textContent = description;

        const temperatureElement = document.createElement("p");
        temperatureElement.className = "forecast-temperature";
        temperatureElement.textContent =
            `${Math.round(dailyData.temperature_2m_max[index])}° / ` +
            `${Math.round(dailyData.temperature_2m_min[index])}°C`;

        const rainElement = document.createElement("p");
        rainElement.className = "forecast-rain";
        rainElement.textContent =
            `Rain: ${dailyData.precipitation_probability_max[index] ?? 0}%`;

        forecastCard.append(
            dateElement,
            iconElement,
            conditionElement,
            temperatureElement,
            rainElement
        );

        forecastList.appendChild(forecastCard);
    });
}



// Generate modern duotone SVG weather icons.
function getWeatherIcon(code) {
    const sun = `
        <circle class="weather-sun-glow" cx="32" cy="30" r="17"/>
        <circle class="weather-sun" cx="32" cy="30" r="11"/>
        <g class="weather-rays">
            <path d="M32 7V12 M32 48V53 M9 30H14 M50 30H55
                     M16 14L20 18 M44 42L48 46
                     M48 14L44 18 M20 42L16 46"/>
        </g>`;

    const cloud = `
        <path class="weather-cloud-shadow"
            d="M18 49h27a11 11 0 0 0 0-22
            15 15 0 0 0-29-3 12 12 0 0 0 2 25z"/>
        <path class="weather-cloud"
            d="M17 45h28a9 9 0 0 0 0-18
            13 13 0 0 0-25-2 10 10 0 0 0-3 20z"/>`;

    const rain = `
        <path class="weather-rain"
            d="M23 49l-4 7 M35 49l-4 7 M47 49l-4 7"/>`;

    const snow = `
        <g class="weather-snow">
            <path d="M22 49v9 M18 51l8 5 M26 51l-8 5"/>
            <path d="M39 49v9 M35 51l8 5 M43 51l-8 5"/>
        </g>`;

    const fog = `
        <g class="weather-fog">
            <path d="M13 47h38 M18 54h30 M22 61h24"/>
        </g>`;

    const thunder = `
        <path class="weather-lightning"
            d="M34 43L25 56h9l-3 11 14-18h-9l4-6z"/>`;

    let artwork = "";

    if (code === 0) {
        artwork = sun;
    } else if (code === 1 || code === 2) {
        artwork = sun + cloud;
    } else if (code === 45 || code === 48) {
        artwork = cloud + fog;
    } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
        artwork = cloud + snow;
    } else if ([95, 96, 99].includes(code)) {
        artwork = cloud + thunder + (code === 96 || code === 99 ? snow : "");
    } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        artwork = cloud + rain;
    } else {
        artwork = cloud;
    }

    return `
        <svg class="weather-svg"
            viewBox="0 0 64 72"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true">
            ${artwork}
        </svg>`;
}



// Kuhaon ang current weather ug 7-day forecast.
async function fetchCurrentWeather(latitude, longitude) {
    const requestId = ++weatherRequestId;

    const temperature = document.getElementById("current-temperature");
    const description = document.getElementById("weather-description");
    const location = document.getElementById("weather-location");
    const icon = document.getElementById("weather-icon");
    const forecastList = document.getElementById("forecast-list");
    const loading = document.getElementById("weather-loading");
    const retryButton = document.getElementById("retry-weather");

    // Ipakita ang loading state.
    if (description) {
        description.textContent = "Loading weather data...";
    }

    if (loading) {
        loading.hidden = false;
    }

    if (retryButton) {
        retryButton.hidden = true;
    }

    if (forecastList) {
        forecastList.classList.remove("is-error");
        forecastList.classList.add("is-loading");
        forecastList.textContent = "Loading 7-day forecast...";
    }

    const weatherParams = new URLSearchParams({
        latitude: latitude,
        longitude: longitude,
        current: [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "weather_code",
            "wind_speed_10m",
            "precipitation"
        ].join(","),
        daily: [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_probability_max",
            "wind_speed_10m_max"
        ].join(","),
        temperature_unit: "celsius",
        wind_speed_unit: "kmh",
        timezone: "Asia/Manila",
        forecast_days: "7"
    });

    const weatherURL =
        `https://api.open-meteo.com/v1/forecast?${weatherParams.toString()}`;

    try {
        const response = await fetch(weatherURL);

        if (!response.ok) {
            throw new Error("Unable to get weather data.");
        }

        const data = await response.json();

        if (requestId !== weatherRequestId) {
            return false;
        }

        if (!data.current || !data.daily) {
            throw new Error("Invalid weather data received.");
        }

        const current = data.current;
        const [weatherDescription] =
            getWeatherInfo(current.weather_code);

        if (temperature) {
            temperature.textContent =
                `${Math.round(current.temperature_2m)}°C`;
        }

        if (description) {
            description.textContent =
                `${weatherDescription} • Feels like ${Math.round(current.apparent_temperature)}°C` +
                ` • Humidity ${current.relative_humidity_2m}%` +
                ` • Wind ${Math.round(current.wind_speed_10m)} km/h`;
        }

        if (location) {
            location.textContent = currentLocation.name;
        }

        if (icon) {
            icon.innerHTML = getWeatherIcon(current.weather_code);
        }

        if (loading) {
            loading.hidden = true;
        }

        if (retryButton) {
            retryButton.hidden = true;
        }

        if (forecastList) {
            forecastList.classList.remove("is-loading", "is-error");
        }

        renderForecast(data.daily);

        return true;

    } catch (error) {
        console.error("Open-Meteo weather error:", error);

        if (requestId === weatherRequestId) {
            if (description) {
                description.textContent =
                    "Weather unavailable. Please check your internet connection.";
            }

            if (icon) {
                icon.innerHTML = getWeatherIcon(-1);
            }

            if (location) {
                location.textContent = currentLocation.name;
            }

            if (loading) {
                loading.hidden = true;
            }

            if (retryButton) {
                retryButton.hidden = false;
            }

            if (forecastList) {
                forecastList.classList.remove("is-loading");
                forecastList.classList.add("is-error");
                forecastList.textContent =
                    "Forecast unavailable. Please try again.";
            }
        }

        return false;
    }
}


// I-connect ang retry button sa weather fetching.
function setupWeatherRetry() {
    const retryButton = document.getElementById("retry-weather");

    if (!retryButton || retryButton.dataset.connected === "true") {
        return;
    }

    retryButton.dataset.connected = "true";

    retryButton.addEventListener("click", function () {
        fetchCurrentWeather(
            currentLocation.latitude,
            currentLocation.longitude
        );
    });
}




// I-start ang EventCast features.
function initializeEventCast() {
    setupThemeToggle();
    initializeMap();
    setupLocationSearch();
    setupLocationSearchClear();
    setupNavigation();
    setupMobileNavigation();
    setupWeatherRetry();

    fetchCurrentWeather(
        currentLocation.latitude,
        currentLocation.longitude
    );

    console.log("EventCast initialized successfully.");
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


// I-setup ang mobile sidebar menu.
function setupMobileNavigation() {
    const menuButton = document.getElementById("mobile-menu-toggle");
    const sidebar = document.getElementById("main-sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    const navigation = document.getElementById("main-navigation");

    if (!menuButton || !sidebar || !backdrop) return;

    function closeMenu() {
        sidebar.classList.remove("mobile-open");
        backdrop.classList.remove("visible");
        document.body.classList.remove("mobile-menu-open");

        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation menu");
    }

    function toggleMenu() {
        const isOpen = sidebar.classList.toggle("mobile-open");

        backdrop.classList.toggle("visible", isOpen);
        document.body.classList.toggle("mobile-menu-open", isOpen);

        menuButton.setAttribute("aria-expanded", String(isOpen));
        menuButton.setAttribute(
            "aria-label",
            isOpen ? "Close navigation menu" : "Open navigation menu"
        );
    }

    menuButton.addEventListener("click", toggleMenu);
    backdrop.addEventListener("click", closeMenu);

    navigation.addEventListener("click", function (event) {
        if (event.target.closest("a[data-page]")) {
            closeMenu();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeMenu();
        }
    });
}
