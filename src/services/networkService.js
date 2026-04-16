const DEFAULT_API_BASE_URL = 'http://localhost:4000';

function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;
}

export async function fetchNetworkStatus() {
  const response = await fetch(`${getApiBaseUrl()}/api/network-status`);

  if (!response.ok) {
    return {
      online: false,
      mode: 'offline',
    };
  }

  return response.json();
}
