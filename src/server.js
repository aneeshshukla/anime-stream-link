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

async function getEpisodes(animeId) {
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
        if (episodesList) {
        return episodesList}
        
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
    const episodesList = await getEpisodes(animeId)
    if (streamLink) {
        res.json({ success: true,episodesList, streamLink, streamServers });
    } else {
        res.status(404).json({ success: false, error: 'Stream link not found' });
    }
});

app.get('/api/episodes/:animeId', async (req, res) => {
    const { animeId } = req.params;
    const episodesList = await getEpisodes(animeId);
    res.json({success: true, episodesList})
})

app.get('/home', (req, res) => {
    // Returning sample mock data as requested
    res.json({
        "spotlight": [
            {
            title: "Hell’s Paradise Season 2",
            logo: "https://artworks.thetvdb.com/banners/v4/series/402474/clearlogo/6957f8d4d5732.png",
            banner: "https://artworks.thetvdb.com/banners/v4/series/402474/backgrounds/697685e7487aa.jpg",
            description: "The second season of Jigokuraku.",
            season: "Winter 2026",
            episode: "8",
            timeLeft: "4d 20h",
            status: "Releasing",
            type: "TV"
        },
        {
            title: "Frieren: Beyond Journey’s End Season 2",
            logo: "https://artworks.thetvdb.com/banners/v4/series/424536/clearlogo/65d798fbd2f61.png",
            banner: "https://artworks.thetvdb.com/banners/v4/series/424536/backgrounds/64e6c54bb62c9.jpg",
            description: "The second season of Frieren: Beyond Journey’s End.",
            season: "Winter 2026",
            episode: "12",
            timeLeft: "2d 4h",
            status: "Releasing",
            type: "TV"
        },
        {
            title: "There was a Cute Girl in the Hero’s Party, so I Tried Confessing to Her",
            logo: "https://artworks.thetvdb.com/banners/v4/series/465505/clearlogo/695d3b9c51907.png",
            banner: "https://artworks.thetvdb.com/banners/v4/series/465505/backgrounds/695d278968c35.jpg",
            description: "Reincarnated as a mid-tier demon, Youki had one job: Crush the hero’s party. Then he saw the party’s priestess, Cecilia, and fell for her hard. Now this lovestruck demon vows to confess his feelings, even if it means betraying the Demon King. Will love bloom between these two sworn enemies?",
            season: "Winter 2026",
            episode: "8",
            timeLeft: "6d 9h",
            status: "Releasing",
            type: "TV"
        },
        {
            title: "ONE PIECE",
            logo: "https://artworks.thetvdb.com/banners/v4/series/81797/clearlogo/611b6189d88b6.png",
            banner: "https://artworks.thetvdb.com/banners/v4/series/81797/backgrounds/616009a8bd688.jpg",
            description: "Gold Roger was known as the Pirate King, the strongest and most infamous being to have sailed the Grand Line. The capture and death of Roger by the World Government brought a change throughout the world. His last words before his death revealed the location of the greatest treasure in the world, One Piece. It was this revelation that brought about the Grand Age of Pirates, men who dreamed of finding One Piece (which promises an unlimited amount of riches and fame), and quite possibly the most coveted of titles for the person who found it, the title of the Pirate King.",
            season: "Winter 2026",
            episode: "1155",
            timeLeft: "39d 20h",
            status: "Releasing",
            type: "TV"
        },
        {
            title: "Jujutsu Kaisen: The Culling Game Part 1",
            logo: "https://artworks.thetvdb.com/banners/v4/series/377543/clearlogo/611c681d42ac0.png",
            banner: "/custom-posters/Jujutsu-Kaisen-The-Culling-Game-Part-1-Itadori-and-the-red-moon.jpg",
            description: "The third season of Jujutsu Kaisen. After the Shibuya Incident, a deadly jujutsu battle known as the Culling Game orchestrated by Noritoshi Kamo erupts across ten colonies in Japan.",
            season: "Winter 2026",
            episode: "8",
            timeLeft: "1d 20h",
            status: "Releasing",
            type: "TV"
        },
        {
            title: "I Want to Eat Your Pancreas",
            logo: "https://image.tmdb.org/t/p/original/iOGhQzUidBzOj6pxKp7pBZkw2ta.png",
            banner: "https://artworks.thetvdb.com/banners/movies/16877/backgrounds/16877.jpg",
            description: "Spring time in April and the last of the cherry blossoms are still in bloom. The usually aloof bookworm with no interest in others comes across a book in a hospital waiting room. Handwritten on the cover are the words: 'Living with Dying'. He soon discovers that it is a diary kept by his very popular and genuinely cheerful classmate, Sakura Yamauchi, who reveals to him that she is secretly suffering from a pancreatic illness and only has a limited time left. It is at this moment that she gains just one more person to share her secret.",
            season: "Summer 2018",
            type: "Movie",
            episode: "NA",
            status: "Completed"
            // timeLeft: "2d 4h"
        }
    ],
        "recently added": [
            {
            title: "The Case Book of Arne",
            poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx183984-uq5scAXrhEdx.jpg",
            type: "TV",
            episodes: 12,
            status: "Releasing"
        },
        {
            title: "Isekai Office Worker",
            poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx183661-3muPFi4LtHmK.jpg",
            type: "TV",
            episodes: 12,
            status: "Releasing"
        },
        {
            title: "The Darwin Incident",
            poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx177679-BgsgE0fQk3qN.jpg",
            type: "TV",
            episodes: 13,
            status: "Releasing"
        },
        {
            title: "Tune In to the Midnight Heart",
            poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx187942-c2cZvunJGfiE.jpg",
            type: "TV",
            episodes: 12,
            status: "Releasing"
        },
        {
            title: "Yoroi-Shinden Samurai Johnny",
            poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx194318-V3STmm4wutVQ.jpg",
            type: "TV",
            episodes: 12,
            status: "Releasing"
        },
        {
            title: "'Tis Time for \"Torture,\" Princess Season 2",
            poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx176370-hz2H4TUeyGgt.png",
            type: "TV",
            episodes: 12,
            status: "Releasing"
        },
        {
            title: "Koupen-chan",
            poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx185646-2eGmsnaSHiLC.jpg",
            type: "TV Short",
            episodes: 47,
            status: "Releasing"
        },
        {
            title: "You Can't Be in a Real Harem",
            poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx189565-OHhadYSsd0Bg.jpg",
            type: "TV",
            episodes: 12,
            status: "Releasing"
        },
        {
            title: "There Was a Cute Girl in the Hero's Party",
            poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195515-p1nD71Hmr4ly.jpg",
            type: "TV",
            episodes: 12,
            status: "Releasing"
        }
    ],
    //     "popular-anime": [
    //         { id: "3", title: "Very Popular Anime", type: "TV", episodes: 100 }
    //     ],
    //     "popular-movies": [
    //         { id: "4", title: "Popular Anime Movie", type: "Movie", episodes: 1 }
    //     ],
    //     "seasonal anime": [
    //         { id: "5", title: "This Season's Hit", type: "TV", episodes: 12 }
    //     ],
    //     "anime of all time": [
    //         { id: "6", title: "Legendary Anime", type: "TV", episodes: 500 }
    //     ],
    //     "coming soon": [
    //         { id: "7", title: "Next Year's Hype", type: "TV", episodes: null }
    //     ]
    });
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
