const apiKey = 'ef75ab0b22d7e108b75fda1dae3f1de4'; // Add your OpenWeather API key
const apiKey = 'YOUR_API_KEY_HERE'; // Add your OpenWeather API key

// 🌟 LOCAL STORAGE ENGINE
let cityList = JSON.parse(localStorage.getItem('weatherAppCities')) || ['New York', 'London', 'Tokyo'];
let currentIndex = parseInt(localStorage.getItem('weatherAppIndex')) || 0;

function saveLocalData() {
    localStorage.setItem('weatherAppCities', JSON.stringify(cityList));
    localStorage.setItem('weatherAppIndex', currentIndex.toString());
}

let isCelsius = true;
let rawData = { temp: 27, feels: 30, wind: 8, aqi: 1, precip: 0 };
let forecastList = [];
let cityTimezoneOffset = 0; 

// 🌟 SIMPLE, FOOLPROOF TIME EXTRACTOR
// This avoids browser timezone crashes.
function getCityTime(unixSeconds, offsetSeconds) {
    const d = new Date((unixSeconds + offsetSeconds) * 1000);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return {
        h: d.getUTCHours().toString().padStart(2, '0'),
        m: d.getUTCMinutes().toString().padStart(2, '0'),
        day: d.getUTCDate(),
        month: months[d.getUTCMonth()],
        weekday: days[d.getUTCDay()]
    };
}

// 🌟 UI MODALS
function toggleThemeMenu() { document.getElementById('themeMenu').classList.toggle('show'); }
function setTheme(mode) {
    if(mode === 'dark') document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    document.getElementById('themeMenu').classList.remove('show');
}
document.addEventListener('click', (e) => {
    if(!e.target.closest('.dropdown-container')) document.getElementById('themeMenu').classList.remove('show');
});

function toggleSearch() {
    const el = document.getElementById('searchOverlay');
    el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
}

// 🌟 LOCATION & GPS
async function addNewCity() {
    const input = document.getElementById('cityInput').value;
    if (input) {
        if (!cityList.includes(input)) cityList.push(input);
        currentIndex = cityList.indexOf(input);
        saveLocalData();
        await fetchWeather(input);
        document.getElementById('cityInput').value = '';
        toggleSearch();
    }
}

function getLocation() {
    if (!navigator.geolocation) return alert("Geolocation not supported by this browser.");
    const inputField = document.getElementById('cityInput');
    inputField.value = "Locating via GPS..."; 
    
    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`);
            const data = await res.json();
            
            if (!cityList.includes(data.name)) cityList.push(data.name);
            currentIndex = cityList.indexOf(data.name);
            saveLocalData();
            
            await fetchWeather(data.name);
            inputField.value = '';
            inputField.placeholder = "Enter city name...";
            toggleSearch(); 
        } catch(e) {
            alert("Location fetch failed.");
            inputField.value = '';
        }
    }, () => {
        alert("Please allow Location Access in your browser settings.");
        inputField.value = '';
    });
}

function changeCity(direction) {
    currentIndex = (currentIndex + direction + cityList.length) % cityList.length;
    saveLocalData();
    fetchWeather(cityList[currentIndex]);
}

// 🌟 API FETCH (Weather + Forecast + AQI)
async function fetchWeather(city) {
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`);
        const data = await res.json();
        
        const fRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`);
        const fData = await fRes.json();
        
        // Fetch AQI
        const aqiRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${data.coord.lat}&lon=${data.coord.lon}&appid=${apiKey}`);
        const aqiData = await aqiRes.json();
        
        cityTimezoneOffset = data.timezone; 
        
        rawData.temp = data.main.temp;
        rawData.feels = data.main.feels_like;
        rawData.wind = data.wind.speed;
        rawData.aqi = aqiData.list[0].main.aqi; 
        rawData.precip = data.rain ? data.rain['1h'] || 0 : 0;
        
        forecastList = fData.list;

        // UI Text
        document.getElementById('cityName').innerText = `${data.name}, ${data.sys.country}`;
        document.getElementById('condition').innerText = data.weather[0].main.includes("Cloud") ? "☁️ Cloudy" : "☀️ Sunny";
        document.getElementById('humidity').innerText = data.main.humidity;
        document.getElementById('precipValue').innerText = `${rawData.precip} mm`;
        
        const sr = getCityTime(data.sys.sunrise, cityTimezoneOffset);
        const ss = getCityTime(data.sys.sunset, cityTimezoneOffset);
        document.getElementById('sunrise').innerText = `${sr.h}:${sr.m}`;
        document.getElementById('sunset').innerText = `${ss.h}:${ss.m}`;
        
        const now = Math.floor(Date.now() / 1000);
        const ct = getCityTime(now, cityTimezoneOffset);
        document.getElementById('currentDate').innerText = `Today ${ct.day} ${ct.month} • ${ct.h}:${ct.m}`;
        
        updateUI();
        updateView('today'); 
    } catch (e) { 
        console.error("Fetch Error:", e);
        if (cityList.length > 1) { currentIndex = 0; saveLocalData(); }
    }
}

// 🌟 CHART SWITCHER
function updateView(view) {
    let points = [];
    document.getElementById('btnPrevDay').style.display = view === 'today' ? 'none' : 'inline-block';
    document.getElementById('btnNextDay').style.display = view === 'today' ? 'inline-block' : 'none';
    
    if (view === 'today') {
        document.getElementById('chartTitle').innerText = "Upcoming hours";
        points = forecastList.slice(0, 8).map(i => {
            const t = getCityTime(i.dt, cityTimezoneOffset);
            return {
                time: `${t.h}:00`, 
                icon: i.weather[0].main.includes("Cloud") ? "☁️" : "☀️",
                temp: i.main.temp, pop: Math.round((i.pop || 0) * 100) + "%"
            };
        });
    } else {
        document.getElementById('chartTitle').innerText = "Next 5 Days";
        points = forecastList.filter(i => i.dt_txt.includes("12:00:00")).map(i => {
            const t = getCityTime(i.dt, cityTimezoneOffset);
            return {
                time: t.weekday,
                icon: i.weather[0].main.includes("Cloud") ? "☁️" : "☀️",
                temp: i.main.temp, pop: Math.round((i.pop || 0) * 100) + "%"
            };
        });
    }
    renderChartLabels(points);
}

// 🌟 UI GAUGES & AQI
function updateUI() {
    const convert = (c) => isCelsius ? Math.round(c) : Math.round((c * 9/5) + 32);
    
    document.getElementById('mainTemp').innerText = `${convert(rawData.temp)}°`;
    document.getElementById('feelsLike').innerText = `${convert(rawData.feels)}°`;
    document.getElementById('feelsFill').style.width = Math.min((rawData.feels / 50 * 100), 100) + "%";

    const rotation = (rawData.wind / 40) * 180 - 30;
    document.getElementById('windNeedle').style.transform = `rotate(${rotation}deg)`;
    document.getElementById('windSpeed').innerText = `${Math.round(rawData.wind)} km/h`;
    
    // AQI Logic
    const aqiMap = {1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Hazardous"};
    document.getElementById('aqiValue').innerText = rawData.aqi;
    document.getElementById('aqiStatus').innerText = aqiMap[rawData.aqi] || "Unknown";
    
    const segments = document.querySelectorAll('#aqiBar .segment');
    segments.forEach((seg, index) => {
        if (index < rawData.aqi) seg.classList.add('active');
        else seg.classList.remove('active');
    });
}

function toggleUnits() {
    isCelsius = !document.getElementById('unitSlider').checked;
    updateUI();
    updateView(document.getElementById('chartTitle').innerText.includes("Upcoming") ? 'today' : 'forecast');
}

// 🌟 CHART RENDERING
function renderChartLabels(points) {
    const topContainer = document.getElementById('chartLabels');
    const bottomContainer = document.getElementById('chartBottomLabels');
    topContainer.innerHTML = ''; bottomContainer.innerHTML = '';
    
    const convert = (c) => isCelsius ? Math.round(c) : Math.round((c * 9/5) + 32);

    points.forEach(data => {
        topContainer.innerHTML += `
            <div class="col-label">
                <span class="time">${data.time}</span><span class="icon">${data.icon}</span><span class="temp">${convert(data.temp)}°</span>
                <div style="position: absolute; bottom: -115px; width: 1px; height: 115px; background-color: var(--grid-line); z-index: -1;"></div>
            </div>`;
        bottomContainer.innerHTML += `<div class="col-bottom">${data.pop}</div>`;
    });

    initAreaChart(points.map(p => convert(p.temp)));
}

function initAreaChart(temps) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: temps.map((_, i) => i),
            datasets: [{ data: temps, borderColor: '#5c9ce5', borderWidth: 2, backgroundColor: '#5c9ce5', fill: true, tension: 0, pointRadius: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { left: -10, right: -10, top: 20, bottom: 0 } },
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false, min: Math.min(...temps) - 5 } }
        }
    });
}



// 🌟 AUTO-LOAD ON STARTUP
// ==========================================
// AUTO-LOAD CURRENT LOCATION ON STARTUP
// ==========================================
window.onload = () => {
    // Check if the browser supports GPS
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            try {
                // Fetch the city name based on the user's coordinates
                const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`);
                const data = await res.json();
                
                // Add this city to the carousel if it's not there
                if (!cityList.includes(data.name)) {
                    cityList.push(data.name);
                }
                currentIndex = cityList.indexOf(data.name);
                
                // Load the dashboard with the exact GPS location
                fetchWeather(data.name);
                
            } catch(e) {
                // If the API fails, safely load the default city
                fetchWeather(cityList[0]); 
            }
        }, () => {
            // If the user clicks "Block" for location access, safely load the default city
            fetchWeather(cityList[0]); 
        });
    } else {
        // If the browser doesn't have GPS, load the default city
        fetchWeather(cityList[0]);
    }
};
