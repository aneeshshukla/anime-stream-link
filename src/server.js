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

// ─── Fetch Management ───
async function fetchData(url, options = {}, retries = 3) {
    let lastError;
    
    // Default 10 second timeout for requests to avoid hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const fetchOptions = { ...options, signal: options.signal || controller.signal };

    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            if (res.status === 429) {
                console.warn(`Rate limited! Retrying... (${i + 1}/${retries})`);
                continue; 
            }
            return res; 
        } catch (error) {
            lastError = error;
            console.warn(`Fetch failed (Attempt ${i + 1}/${retries}): ${error.message}`);
        }
    }
    
    clearTimeout(timeoutId);
    throw lastError || new Error("Failed to fetch after multiple retries");
}

// ─── Shared helper: fetch episode list for an anime ───
async function fetchEpisodesList(animeId) {
    try {
        if (CUSTOM_REMAPS[animeId]) {
            const fetchUrl = `${streamApiUrl}/episodes/${CUSTOM_REMAPS[animeId]}`;
            console.log(`[fetchEpisodesList] Remapped fetch: ${fetchUrl}`);
            const res = await fetchData(fetchUrl);
            const data = await res.json();
            return data.data || [];
        } else {
            const fetchUrl = `${mapperUrl}/anime/info/${animeId}`;
            console.log(`[fetchEpisodesList] Standard fetch: ${fetchUrl}`);
            const res = await fetchData(fetchUrl);
            const data = await res.json();
            return data.data?.episodesList || [];
        }
    } catch (error) {
        console.error("[fetchEpisodesList] Error:", error);
        return [];
    }
}

// ─── Find a single episode ID from the list ───
function findEpisodeId(episodesList, epNum = '1') {
    const episode = episodesList.find(
        (ep) => ep.episodeNumber == epNum || ep.number == epNum
    );
    if (episode?.id) {
        console.log(`[findEpisodeId] Found Episode ${epNum}: ${episode.id}`);
        return episode.id.includes("::") ? episode.id : episode.id.replace("?", "::");
    }
    console.warn(`[findEpisodeId] Episode ${epNum} not found`);
    return null;
}

// ─── Build a stream embed URL ───
function buildStreamLink(hianimeEpisodeId, serverId = 'hd-1', type = 'sub') {
    return `${streamApiUrl}/embed/${serverId}/${hianimeEpisodeId}/${type}`;
}

// ─── Fetch stream servers for a given episode ───
async function fetchStreamServers(hianimeEpisodeId) {
    try {
        const res = await fetchData(`${streamApiUrl}/servers?id=${hianimeEpisodeId}`);
        return await res.json();
    } catch (error) {
        console.error("[fetchStreamServers] Error:", error);
        return null;
    }
}

// ─── Shared: format airing info ───
function formatAiringInfo(media) {
    let timeLeft = "";
    let episodeCount = media.episodes?.toString() || "NA";
    if (media.nextAiringEpisode) {
        const seconds = media.nextAiringEpisode.timeUntilAiring;
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        timeLeft = `${days}d ${hours}h`;
        episodeCount = media.nextAiringEpisode.episode?.toString();
    }
    return { timeLeft, episodeCount };
}

// ─── Shared: format status string ───
function formatStatus(status) {
    if (status === 'FINISHED') return 'Completed';
    if (!status) return 'Unknown';
    return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}

// ─── Shared: extract banner & logo from ani.zip images ───
function extractAniZipImages(aniZipData, customOverride) {
    if (customOverride) {
        return { banner: customOverride.banner, logo: customOverride.logo };
    }
    let banner = "";
    let logo = "";
    const images = aniZipData?.images || [];
    for (const img of images) {
        if (img.coverType === 'Fanart' && !banner) banner = img.url;
        if (img.coverType === 'Clearlogo' && !logo) logo = img.url;
        if (banner && logo) break;
    }
    return { banner, logo };
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the JS API Template' });
});

// ─── Stream endpoint ───
// FIX: Previously called getHianimeEpisodeId 3 times (once per function).
//      Now fetches the episode list ONCE, then derives everything from it.
app.get('/api/stream/:animeId', async (req, res) => {
    try {
        const { animeId } = req.params;
        const { ep = '1', server = 'hd-1', type = 'sub' } = req.query;

        // Single fetch for episodes
        const episodesList = await fetchEpisodesList(animeId);
        const hianimeEpisodeId = findEpisodeId(episodesList, ep);

        if (!hianimeEpisodeId) {
            return res.status(404).json({ success: false, error: 'Stream link not found' });
        }

        // Build link + fetch servers in parallel
        const [streamServers] = await Promise.all([
            fetchStreamServers(hianimeEpisodeId),
        ]);
        const streamLink = buildStreamLink(hianimeEpisodeId, server, type);

        res.json({ success: true, episodesList, streamLink, streamServers });
    } catch (err) {
        console.error(`[/api/stream] Error:`, err);
        res.status(500).json({ success: false, error: 'Failed to fetch stream data' });
    }
});

// ─── Episodes endpoint ───
app.get('/api/episodes/:animeId', async (req, res) => {
    try {
        const { animeId } = req.params;
        const episodesList = await fetchEpisodesList(animeId);
        res.json({ success: true, episodesList });
    } catch (err) {
        console.error(`[/api/episodes] Error:`, err);
        res.status(500).json({ success: false, error: 'Failed to fetch episodes' });
    }
});

// ─── Home endpoint ───
// FIX: Previously fetched each spotlight ID sequentially in a for-loop.
//      Now uses Promise.all to fetch all spotlight data in parallel.
app.get('/home', async (req, res) => {
    const customMapping = {
        99750: {
            logo: "https://image.tmdb.org/t/p/original/iOGhQzUidBzOj6pxKp7pBZkw2ta.png",
            banner: "https://artworks.thetvdb.com/banners/movies/16877/backgrounds/16877.jpg"
        }
    };
    const fixedSpotlightIds = [195322, 166613, 182255, 21, 195515, 172463, 99750];

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

    // Fetch all spotlight entries in parallel
    const spotlightResults = await Promise.allSettled(
        fixedSpotlightIds.map(async (anilistId) => {
            const [anilistRes, aniZipRes] = await Promise.all([
                fetchData('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query, variables: { id: anilistId } }),
                }).then(r => r.json()),

                fetchData(`https://api.ani.zip/mappings?anilist_id=${anilistId}`)
                    .then(r => r.json())
                    .catch(() => null),
            ]);

            const media = anilistRes?.data?.Media;
            if (!media) return null;

            const { banner, logo } = extractAniZipImages(aniZipRes, customMapping[anilistId]);
            const { timeLeft, episodeCount } = formatAiringInfo(media);

            return {
                id: media.id,
                title: media.title.english || media.title.romaji || "",
                logo: logo || media.coverImage?.extraLarge || "",
                banner: banner || media.bannerImage || media.coverImage?.extraLarge || "",
                description: media.description?.replace(/<[^>]*>?/gm, "") || "",
                season: (media.season && media.seasonYear)
                    ? `${media.season.charAt(0) + media.season.slice(1).toLowerCase()} ${media.seasonYear}`
                    : "Unknown",
                episode: episodeCount,
                timeLeft: timeLeft,
                status: formatStatus(media.status),
                type: media.format || "TV"
            };
        })
    );

    // Collect only fulfilled, non-null results
    const responseData = spotlightResults
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

    res.json({
        "spotlight": responseData,
        "recently added": [
            {   
                id: 183984,
                title: "The Case Book of Arne",
                poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx183984-uq5scAXrhEdx.jpg",
                type: "TV",
                episodes: 12,
                status: "Releasing"
            },
            {
                id: 183661,
                title: "Isekai Office Worker",
                poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx183661-3muPFi4LtHmK.jpg",
                type: "TV",
                episodes: 12,
                status: "Releasing"
            },
            {
                id: 177679,
                title: "The Darwin Incident",
                poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx177679-BgsgE0fQk3qN.jpg",
                type: "TV",
                episodes: 13,
                status: "Releasing"
            },
            {
                id: 187942,
                title: "Tune In to the Midnight Heart",
                poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx187942-c2cZvunJGfiE.jpg",
                type: "TV",
                episodes: 12,
                status: "Releasing"
            },
            {
                id: 194318,
                title: "Yoroi-Shinden Samurai Johnny",
                poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx194318-V3STmm4wutVQ.jpg",
                type: "TV",
                episodes: 12,
                status: "Releasing"
            },
            {
                id: 176370,
                title: "'Tis Time for \"Torture,\" Princess Season 2",
                poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx176370-hz2H4TUeyGgt.png",
                type: "TV",
                episodes: 12,
                status: "Releasing"
            },
            {
                id: 185646,
                title: "Koupen-chan",
                poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx185646-2eGmsnaSHiLC.jpg",
                type: "TV Short",
                episodes: 47,
                status: "Releasing"
            },
            {
                id: 189565,
                title: "You Can't Be in a Real Harem",
                poster: "https://serveproxy.com/?url=https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx189565-OHhadYSsd0Bg.jpg",
                type: "TV",
                episodes: 12,
                status: "Releasing"
            },
            {
                id: 195515,
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

// ─── Anime detail endpoint ───
app.get('/anime/:id', async (req, res) => {
    const { id } = req.params;

    const query = `
    query ($id: Int) {
        Media(id: $id, type: ANIME) {
            id
            title {
                romaji
                english
                native
            }
            coverImage {
                extraLarge
                large
                color
            }
            bannerImage
            description
            season
            seasonYear
            episodes
            duration
            nextAiringEpisode {
                timeUntilAiring
                episode
            }
            status
            format
            genres
            averageScore
            meanScore
            popularity
            favourites
            source
            countryOfOrigin
            startDate { year month day }
            endDate { year month day }
            studios {
                nodes {
                    name
                    isAnimationStudio
                }
            }
            streamingEpisodes {
                title
                thumbnail
                url
                site
            }
            trailer {
                id
                site
            }
            synonyms
            tags {
                name
                rank
            }
            relations {
                edges {
                    relationType
                    node {
                        id
                        title { romaji english }
                        coverImage { extraLarge }
                        format
                        status
                        episodes
                        type
                    }
                }
            }
            characters(sort: [ROLE, RELEVANCE, ID], perPage: 25) {
                edges {
                    role
                    node {
                        id
                        name { userPreferred }
                        image { large }
                    }
                    voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
                        id
                        name { userPreferred }
                        image { large }
                    }
                }
            }
            recommendations(sort: RATING_DESC, perPage: 12) {
                nodes {
                    mediaRecommendation {
                        id
                        title {
                            romaji
                            english
                        }
                        coverImage {
                            extraLarge
                        }
                        bannerImage
                        format
                        status
                        episodes
                        averageScore
                        season
                        seasonYear
                    }
                }
            }
        }
    }
    `;

    try {
        // Fire all three requests in parallel
        const [anilistResponse, episodesList, aniZipResponse] = await Promise.all([
            fetchData('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query, variables: { id: parseInt(id) } }),
            }).then(r => r.json()),

            fetchEpisodesList(id),

            fetchData(`https://api.ani.zip/mappings?anilist_id=${id}`)
                .then(r => r.json())
                .catch(() => null),
        ]);

        const media = anilistResponse?.data?.Media;
        if (!media) {
            return res.status(404).json({ success: false, error: 'Anime not found' });
        }
        const { banner: aniZipBanner, logo: aniZipLogo } = extractAniZipImages(aniZipResponse);
        const { timeLeft, episodeCount } = formatAiringInfo(media);

        // Build recommendations array
        const recommendations = (media.recommendations?.nodes || [])
            .filter(n => n.mediaRecommendation)
            .map(n => {
                const rec = n.mediaRecommendation;
                return {
                    id: rec.id,
                    title: rec.title.english || rec.title.romaji || "",
                    poster: rec.coverImage?.extraLarge || "",
                    format: rec.format || "TV",
                    status: formatStatus(rec.status),
                    episodes: rec.episodes,
                    averageScore: rec.averageScore,
                    season: rec.season,
                    seasonYear: rec.seasonYear,
                };
            });

        // Build relations array
        const relations = (media.relations?.edges || []).map(edge => ({
            relationType: edge.relationType,
            id: edge.node.id,
            title: edge.node.title.english || edge.node.title.romaji || "",
            poster: edge.node.coverImage?.extraLarge || "",
            format: edge.node.format,
            status: formatStatus(edge.node.status),
            episodes: edge.node.episodes,
            type: edge.node.type,
        }));

        // Build studios array
        const studios = (media.studios?.nodes || []).map(s => ({
            name: s.name,
            isAnimationStudio: s.isAnimationStudio,
        }));

        // Build characters array
        const characters = (media.characters?.edges || []).map(edge => ({
            role: edge.role,
            id: edge.node?.id,
            name: edge.node?.name?.userPreferred || "",
            image: edge.node?.image?.large || "",
            voiceActors: (edge.voiceActors || []).map(va => ({
                id: va.id,
                name: va.name?.userPreferred || "",
                image: va.image?.large || ""
            }))
        }));

        res.json({
            success: true,
            data: {
                id: media.id,
                title: media.title.english || media.title.romaji || "",
                titleRomaji: media.title.romaji || "",
                titleNative: media.title.native || "",
                poster: media.coverImage?.extraLarge || "",
                logo: aniZipLogo || "",
                color: media.coverImage?.color || "",
                banner: aniZipBanner || media.bannerImage || media.coverImage?.extraLarge || "",
                description: media.description?.replace(/<[^>]*>?/gm, "") || "",
                season: (media.season && media.seasonYear)
                    ? `${media.season.charAt(0) + media.season.slice(1).toLowerCase()} ${media.seasonYear}`
                    : "Unknown",
                episode: episodeCount,
                totalEpisodes: media.episodes,
                duration: media.duration,
                timeLeft: timeLeft,
                status: formatStatus(media.status),
                type: media.format || "TV",
                genres: media.genres || [],
                averageScore: media.averageScore,
                meanScore: media.meanScore,
                popularity: media.popularity,
                favourites: media.favourites,
                source: media.source,
                countryOfOrigin: media.countryOfOrigin,
                startDate: media.startDate,
                endDate: media.endDate,
                studios: studios,
                streamingEpisodes: media.streamingEpisodes || [],
                trailer: media.trailer,
                synonyms: media.synonyms || [],
                tags: (media.tags || []).slice(0, 10).map(t => ({ name: t.name, rank: t.rank })),
                relations: relations,
                characters: characters,
            },
            episodes: (episodesList || []).map(ep => {
                const epNum = parseFloat(ep.number || ep.episodeNumber);
                let thumbnail = "";
                if (media.streamingEpisodes && !isNaN(epNum)) {
                    for (const streamEp of media.streamingEpisodes) {
                        const match = streamEp.title.match(/(?:Episode|Ep)\s*(\d+(\.\d+)?)/i);
                        if (match && parseFloat(match[1]) === epNum) {
                            thumbnail = streamEp.thumbnail;
                            break;
                        }
                    }
                }
                return { ...ep, thumbnail };
            }),
            recommendations: recommendations,
        });
    } catch (err) {
        console.error(`[/anime/${id}] Error:`, err);
        res.status(500).json({ success: false, error: 'Failed to fetch anime data' });
    }
});

// ─── Search endpoint ───
app.get('/search/:query', async (req, res) => {
    const { query: searchQuery } = req.params;
    const { page = 1, perPage = 20 } = req.query;

    const graphqlQuery = `
    query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
            pageInfo {
                total
                currentPage
                lastPage
                hasNextPage
                perPage
            }
            media(search: $search, type: ANIME, sort: [POPULARITY_DESC, SCORE_DESC]) {
                id
                title {
                    romaji
                    english
                    native
                }
                coverImage {
                    extraLarge
                    color
                }
                format
                status
                episodes
                averageScore
                season
                seasonYear
            }
        }
    }
    `;

    try {
        const response = await fetchData('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                query: graphqlQuery, 
                variables: { 
                    search: searchQuery, 
                    page: parseInt(page), 
                    perPage: parseInt(perPage) 
                } 
            }),
        });
        
        const data = await response.json();

        if (data.errors) {
            return res.status(400).json({ success: false, errors: data.errors });
        }

        const mediaList = data.data.Page.media.map(media => ({
            id: media.id,
            title: media.title.english || media.title.romaji || "",
            poster: media.coverImage?.extraLarge || "",
            format: media.format || "TV",
            status: formatStatus(media.status),
            episodes: media.episodes,
            averageScore: media.averageScore,
            season: media.season,
            seasonYear: media.seasonYear,
            color: media.coverImage?.color || ""
        }));

        res.json({
            success: true,
            pageInfo: data.data.Page.pageInfo,
            results: mediaList
        });
    } catch (err) {
        console.error(`[/search/${searchQuery}] Error:`, err);
        res.status(500).json({ success: false, error: 'Failed to search anime' });
    }
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
