function getAuthTokenInteractive(callback) {
  const clientId = '53a778c860184dbbbd0c4b33fa86a4e0';
  const scopes = 'playlist-modify-public';
  const redirectUri = chrome.identity.getRedirectURL('callback');

  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code`;

  chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  }, (redirectUrl) => {
    if (chrome.runtime.lastError || !redirectUrl) {
      callback(null, chrome.runtime.lastError);
    } else {
      const code = new URL(redirectUrl).searchParams.get('code');
      fetchAccessToken(code, callback);
    }
  });
}

function fetchAccessToken(code, callback) {
  const clientId = '53a778c860184dbbbd0c4b33fa86a4e0';
  const clientSecret = '9a1f881d56a04906b5e55dd7825c2192';  // Replace with your actual client secret
  const redirectUri = chrome.identity.getRedirectURL('callback');

  const tokenUrl = 'https://accounts.spotify.com/api/token';
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  });

  fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      callback(null, new Error(data.error));
    } else {
      callback(data.access_token, null);
    }
  })
  .catch(error => {
    callback(null, error);
  });
}
