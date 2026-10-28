const express = require('express');
const app = express();
// Serve static HTML/CSS/JS files from the "public" folder
app.use(express.static('public'));
const PORT = process.env.PORT || 3000;
app.get('/hello', (req,res)=>{
    res.send('Hello from your own server!');
});
app.get(`/greet`,(req,res)=>{
    const userName = req.query.name;
    res.send(`Hello,${userName}!`);
});


app.get('/api/weather', async (req, res) => {
    const query = req.query.city;

    if (!query) {
        return res.status(400).json({ error: 'Please provide a city or state name' });
    }

    try {
        // 1. Ask Open-Meteo for top 5 matches (allows finding states and regions)
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
        const geoResponse = await fetch(geoUrl);
        const geoData = [];
        console.log("Printinng Geo Response", geoResponse)
        console.log("Printinng Geo Data", geoData)
        let location = null;

        if (geoData.results && geoData.results.length > 0) {
            location = geoData.results[0];
            console.log("Printing Location", location)
        } else {
            // 2. FALLBACK to OpenStreetMap Nominatim if Open-Meteo doesn't find the state
            const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
            const osmResponse = await fetch(osmUrl, {
                headers: { 'User-Agent': 'WeatherApp-Tutorial' } // Nominatim requires a user-agent header
            });

            const osmData = await osmResponse.json();
             console.log("Printinng osm Response", osmResponse)
              console.log("Printinng osm Data", osmData)

            if (osmData && osmData.length > 0) {
                location = {
                    name: osmData[0].name || query,
                    latitude: parseFloat(osmData[0].lat),
                    longitude: parseFloat(osmData[0].lon),
                    country: osmData[0].display_name.split(',').pop().trim()
                };
            }
        }

        if (!location) {
            return res.status(404).json({ error: `Could not find "${query}"` });
        }

        const { latitude, longitude, name, country } = location;

        // Step 2: Fetch Weather using the discovered coordinates
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m`;
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();

        // Step 3: Send back clean JSON
        res.json({
            place: name,
            country: country,
            coordinates: { latitude, longitude },
            temp: weatherData.current.temperature_2m,
            unit: '°C',
            humidity: weatherData.current.relative_humidity_2m
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});
// Endpoint for live city suggestions / autocomplete
app.get('/api/suggest', async (req, res) => {
    const query = req.query.q;

    // Don't search if the user typed less than 2 characters
    if (!query || query.trim().length < 2) {
        return res.json([]);
    }

    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();

        if (!geoData.results) {
            return res.json([]);
        }

        // Return a lightweight list of matching places
        const suggestions = geoData.results.map(item => ({
            name: item.name,
            state: item.admin1 || '',
            country: item.country || ''
        }));

        res.json(suggestions);
    } catch (err) {
        console.error('Suggest error:', err);
        res.json([]); // Return empty array on error so UI doesn't crash
    }
});
app.listen(PORT,() => {
    console.log(`Server is running on port ${PORT}`);
});