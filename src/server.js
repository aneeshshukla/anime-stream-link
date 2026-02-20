const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const HIANIME_MAPPER = process.env.HIANIME_MAPPER;
const STREAM_URL = process.env.STREAM_URL;

// Custom ID Remapping (Anilist ID -> HiAnime ID)
const CUSTOM_REMAPS = {
    '172463': 'jujutsu-kaisen-the-culling-game-part-1-20401',
    '131573': 'jujutsu-kaisen-0-movie-17763'
};

// Utility to clean base URLs (remove trailing slash)
const cleanBaseUrl = (url) => url ? url.trim().replace(/\/+$/, '') : '';
const mapperUrl = cleanBaseUrl(HIANIME_MAPPER);
const streamApiUrl = cleanBaseUrl(STREAM_URL);

async function getHianimeEpisodeId(animeId, epNum = '1') {
    try {
        let episodesList = [];
        
        if (CUSTOM_REMAPS[animeId]) {
            // Remapped: fetch from streamApiUrl/episodes/
            const fetchUrl = `${streamApiUrl}/episodes/${CUSTOM_REMAPS[animeId]}`;
            console.log(`[getHianimeEpisodeId] Remapped fetch: ${fetchUrl}`);
            const res = await fetch(fetchUrl);
            const data = await res.json();
            episodesList = data.data || [];
        } else {
            // Standard: fetch from mapperUrl/anime/info/
            const fetchUrl = `${mapperUrl}/anime/info/${animeId}`;
            console.log(`[getHianimeEpisodeId] Standard fetch: ${fetchUrl}`);
            const res = await fetch(fetchUrl);
            const data = await res.json();
            episodesList = data.data?.episodesList || [];
        }

        // Search in both episodeNumber (new API) and number (old mapper)
        const episode = episodesList.find((ep) => ep.episodeNumber == epNum || ep.number == epNum);
        
        if (episode && episode.id) {
            console.log(`[getHianimeEpisodeId] Found Episode ${epNum}: ${episode.id}`);
            return episode.id.includes("::") ? episode.id : episode.id.replace("?", "::");
        }
        
        console.warn(`[getHianimeEpisodeId] Episode ${epNum} not found for ${animeId}`);
        return null;
    } catch (error) {
        console.error("Error fetching HiAnime ID:", error);
        return null;
    }
}

async function getStreamLinks(animeId, epNum = '1', serverId = 'hd-1', type = 'sub') {
    const hianimeEpisodeId = await getHianimeEpisodeId(animeId, epNum);
    if (hianimeEpisodeId) {
        return `${streamApiUrl}/embed/${serverId}/${hianimeEpisodeId}/${type}`;
    }
    return null;
}

async function getStreamServers(animeId, epNum = '1') {
    const hianimeEpisodeId = await getHianimeEpisodeId(animeId, epNum);
    if (hianimeEpisodeId) {
        return await fetch(`${streamApiUrl}/servers?id=${hianimeEpisodeId}`).then(res => res.json());
    }
    return null;
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the JS API Template' });
});

// New endpoint for stream links
app.get('/api/stream/:animeId', async (req, res) => {
    const { animeId } = req.params;
    const { ep = '1', server = 'hd-1', type = 'sub' } = req.query;
    
    const streamLink = await getStreamLinks(animeId, ep, server, type);
    const streamServers = await getStreamServers(animeId, ep);
    if (streamLink) {
        res.json({ success: true, streamLink, streamServers });
    } else {
        res.status(404).json({ success: false, error: 'Stream link not found' });
    }
});

app.get('/home', (req, res) => {
    res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Example Resource Route
app.get('/api/resource', (req, res) => {
    res.json({ data: [{ id: 1, name: 'Sample Item' }] });
});

// 404 Handler
app.use((req, res, next) => {
    res.status(404).json({ error: 'Not Found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

