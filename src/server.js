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

app.get('/home', async (req, res) => {
    // Returning sample mock data as requested
    const customMapping = {
        99750: {
            logo: "https://image.tmdb.org/t/p/original/iOGhQzUidBzOj6pxKp7pBZkw2ta.png",
            banner: "https://artworks.thetvdb.com/banners/movies/16877/backgrounds/16877.jpg"
        }
        
    }
    const fixedSpotlightIds = [166613, 182255, 21, 195515, 99750, 172463];
    let responseData = [];

    const query = `
        query ($id: Int) {
            Media(id: $id, type: ANIME) {
                id
                title {
                    english
                    romaji
                }
                bannerImage
                coverImage {
                    extraLarge
                }
                description
                season
                seasonYear
                episodes
                status
                format
                nextAiringEpisode {
                    timeUntilAiring
                    episode
                }
            }
        }
    `;

    for (let i = 0; i < fixedSpotlightIds.length; i++) {
        try {
            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: { id: fixedSpotlightIds[i] }
                })
            });

            const theTvDbResponse = await fetch(`https://api.ani.zip/mappings?anilist_id=${fixedSpotlightIds[i]}`);
            const theTvDbJson = await theTvDbResponse.json();
            const theTvDbImages = theTvDbJson?.images || [];
            let theTvDbBanner = "";
            let theTvDbLogo = "";
            for (let j = 0; j < theTvDbImages.length; j++) {
                if (customMapping[fixedSpotlightIds[i]]) {
                    theTvDbBanner = customMapping[fixedSpotlightIds[i]].banner;
                    theTvDbLogo = customMapping[fixedSpotlightIds[i]].logo;
                    break;
                }
                else if (theTvDbImages[j].coverType === 'Fanart' && !theTvDbBanner) {
                    theTvDbBanner = theTvDbImages[j].url;
                } else if (theTvDbImages[j].coverType === 'Clearlogo' && !theTvDbLogo) {
                    theTvDbLogo = theTvDbImages[j].url;
                }
                if (theTvDbBanner && theTvDbLogo) break;
            }
            if (customMapping[fixedSpotlightIds[i]]) {
                theTvDbBanner = customMapping[fixedSpotlightIds[i]].banner;
                theTvDbLogo = customMapping[fixedSpotlightIds[i]].logo;
            }
            
            const data = await response.json();
            const media = data?.data?.Media;
            
            if (media) {
                let timeLeft = "";
                let episodeCount = media.episodes?.toString() || "NA";
                
                if (media.nextAiringEpisode) {
                    const seconds = media.nextAiringEpisode.timeUntilAiring;
                    const days = Math.floor(seconds / (3600 * 24));
                    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
                    timeLeft = `${days}d ${hours}h`;
                    episodeCount = media.nextAiringEpisode.episode?.toString();
                }

                responseData.push({
                    title: media.title.english || media.title.romaji || "",
                    logo: theTvDbLogo || media.coverImage?.extraLarge || "",
                    banner: theTvDbBanner || media.bannerImage || media.coverImage?.extraLarge || "",
                    description: media.description?.replace(/<[^>]*>?/gm, "") || "",
                    season: (media.season && media.seasonYear) ? `${media.season.charAt(0) + media.season.slice(1).toLowerCase()} ${media.seasonYear}` : "Unknown",
                    episode: episodeCount,
                    timeLeft: timeLeft,
                    status: media.status === 'FINISHED' ? 'Completed' : (media.status ? media.status.charAt(0) + media.status.slice(1).toLowerCase().replace(/_/g, " ") : "Unknown"),
                    type: media.format || "TV"
                });
            }
        } catch (err) {
            console.error(`Failed to fetch AniList data for ID ${fixedSpotlightIds[i]}:`, err);
        }
    }

    res.json({
        "spotlight": responseData,
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
