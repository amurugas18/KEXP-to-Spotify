document.addEventListener('DOMContentLoaded', () => {
  const statusElement = document.getElementById('status');
  const songTitleElement = document.getElementById('song-title');
  const artistElement = document.getElementById('artist');
  const albumElement = document.getElementById('album');
  const albumCoverElement = document.getElementById('album-cover');
  const addSongButton = document.getElementById('addSongButton');
  const headerElement = document.querySelector('.header');

  const airBreakImageUrl = 'airbreak.jpg';

  async function fetchCurrentSong() {
    try {
      console.log('Fetching current song...');
      const response = await fetch('https://api.kexp.org/v2/plays/?limit=1');
      const data = await response.json();
      const song = data.results[0];
      if (song) {
        const showResponse = await fetch(song.show_uri);
        const showData = await showResponse.json();
        console.log('Fetched show data:', showData);
        return {
          artist: song.artist,
          title: song.song,
          album: song.album,
          albumArt: song.image_uri,
          playType: song.play_type,
          programName: showData.program_name,
          hostNames: showData.host_names.join(', ')
        };
      }
      console.log('No song currently playing');
      return null;
    } catch (error) {
      console.error('Error fetching current song:', error);
      statusElement.textContent = 'Error fetching current song';
      return null;
    }
  }

  async function updateCurrentSong() {
    const song = await fetchCurrentSong();
    if (song) {
      if (song.playType === 'airbreak') {
        console.log('Play type is airbreak, updating UI to reflect Air Break status');
        songTitleElement.textContent = "Air Break";
        artistElement.textContent = "";
        albumElement.textContent = "";
        albumCoverElement.src = airBreakImageUrl;
        statusElement.textContent = 'Air Break';
      } else {
        songTitleElement.textContent = song.title;
        artistElement.textContent = song.artist;
        albumElement.textContent = song.album;
        albumCoverElement.src = song.albumArt || airBreakImageUrl;
        statusElement.textContent = 'Current song updated';
      }
      updateHeader(song.programName, song.hostNames);
    } else {
      songTitleElement.textContent = "Air Break";
      artistElement.textContent = "";
      albumElement.textContent = "";
      albumCoverElement.src = airBreakImageUrl;
      statusElement.textContent = 'Air Break';
    }
  }

  function updateHeader(programName, hostNames) {
    headerElement.textContent = `${programName} with ${hostNames}`;
    console.log(`Header updated to: ${programName} with ${hostNames}`);
  }

  setInterval(updateCurrentSong, 5000);
  updateCurrentSong();

  document.getElementById('addSongButton').addEventListener('click', () => {
    console.log('Add song button clicked');
    const redirectUri = chrome.identity.getRedirectURL('callback');
    const authUrl = `https://accounts.spotify.com/authorize?client_id=53a778c860184dbbbd0c4b33fa86a4e0&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user-read-email playlist-modify-public`;
    chrome.identity.launchWebAuthFlow(
      {
        'url': authUrl,
        'interactive': true
      },
      function (redirect_url) {
        if (chrome.runtime.lastError) {
          console.error('Error during OAuth2 flow:', chrome.runtime.lastError.message, chrome.runtime.lastError);
        } else if (!redirect_url) {
          console.error('No redirect URL found.');
        } else {
          let accessToken = redirect_url.match(/access_token=([^&]*)/)[1];
          sessionStorage.setItem('accessToken', accessToken);
          console.log('OAuth2 authentication completed, access token obtained:', accessToken);
          addSongToSpotify(accessToken);
        }
      }
    );
  });

  async function addSongToSpotify(accessToken) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = 'Fetching current song...';
    console.log('Starting addSongToSpotify process');

    try {
      const song = await fetchCurrentSong();
      console.log('Fetched song:', song);

      if (song) {
        if (song.playType === 'airbreak') {
          console.log('Play type is airbreak, updating UI to reflect Air Break status');
          songTitleElement.textContent = "Air Break";
          artistElement.textContent = "";
          albumElement.textContent = "";
          albumCoverElement.src = airBreakImageUrl;
          statusElement.textContent = 'Air Break';
          return;
        }
        
        statusElement.textContent = `Current song: ${song.artist} - ${song.title}. Adding to Spotify...`;
        console.log(`Current song: ${song.artist} - ${song.title}. Adding to Spotify...`);

        const userId = await getSpotifyUserId(accessToken);
        console.log('Fetched Spotify user ID:', userId);

        const playlistId = await getOrCreateKEXPPlaylist(userId, accessToken);
        console.log('Fetched or created playlist ID:', playlistId);

        await addSongToPlaylist(song, accessToken, playlistId);
        console.log('Added song to Spotify playlist');

        statusElement.textContent = 'Song added to your Spotify playlist "KEXP"!';
      } else {
        statusElement.textContent = 'Could not fetch the current song.';
        console.log('Could not fetch the current song.');
      }
    } catch (error) {
      statusElement.textContent = `An error occurred: ${error.message}`;
      console.error('An error occurred:', error);
    }
    console.log('Finished addSongToSpotify process');
  }

  async function getSpotifyUserId(token) {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Error fetching Spotify user ID: ${data.error.message}`);
    }
    console.log('Spotify user ID fetched successfully:', data.id);
    return data.id;
  }

  async function getOrCreateKEXPPlaylist(userId, token) {
    const playlistsResponse = await fetch(`https://api.spotify.com/v1/me/playlists`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const playlistsData = await playlistsResponse.json();
    if (!playlistsResponse.ok) {
      throw new Error(`Error fetching playlists: ${playlistsData.error.message}`);
    }

    const kexpPlaylist = playlistsData.items.find(playlist => playlist.name === 'KEXP');
    if (kexpPlaylist) {
      console.log('Found existing KEXP playlist:', kexpPlaylist.id);
      return kexpPlaylist.id;
    }

    const createResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'KEXP',
        description: 'Playlist of songs from KEXP',
        public: true
      })
    });

    const createData = await createResponse.json();
    if (!createResponse.ok) {
      throw new Error(`Error creating Spotify playlist: ${createData.error.message}`);
    }
    console.log('Created new KEXP playlist:', createData.id);
    return createData.id;
  }

  async function addSongToPlaylist(song, token, playlistId) {
    try {
      const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=track:${encodeURIComponent(song.title)}%20artist:${encodeURIComponent(song.artist)}&type=track`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const searchData = await searchResponse.json();
      if (searchData.error) {
        throw new Error(`Spotify API Error: ${searchData.error.message}`);
      }

      const track = searchData.tracks.items[0];
      if (!track) {
        throw new Error('Track not found on Spotify');
      }

      const addResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uris: [track.uri] })
      });

      const addData = await addResponse.json();
      if (!addResponse.ok) {
        throw new Error(`Spotify API Error: ${addData.error.message}`);
      }

      songTitleElement.textContent = song.title;
      artistElement.textContent = song.artist;
      albumElement.textContent = song.album;
      albumCoverElement.src = song.albumArt || airBreakImageUrl;

      console.log('Song added to playlist:', track.uri);
    } catch (error) {
      statusElement.textContent = `An error occurred: ${error.message}`;
      console.error('An error occurred while adding the song to the playlist:', error);
      throw error;
    }
    console.log('Finished addSongToPlaylist function');
  }
});
