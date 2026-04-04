// ─── Canonical office data (single source of truth) ─────────────────
// Extracted from docs/index.html and api/feed.js so both client and
// server can import from one place.

// Display names for each office (was duplicated in feed.js + HTML <select>)
export const OFFICE_NAMES = {
    'OKX': 'New York', 'BOX': 'Boston', 'PHI': 'Philadelphia', 'LWX': 'Washington DC',
    'PBZ': 'Pittsburgh', 'BUF': 'Buffalo', 'RAH': 'Raleigh', 'CHS': 'Charleston SC',
    'FFC': 'Atlanta', 'MFL': 'Miami', 'JAX': 'Jacksonville', 'TBW': 'Tampa Bay',
    'BMX': 'Birmingham', 'OHX': 'Nashville', 'MRX': 'Morristown', 'JAN': 'Jackson MS',
    'LOT': 'Chicago', 'DTX': 'Detroit', 'IND': 'Indianapolis', 'CLE': 'Cleveland',
    'ILN': 'Cincinnati', 'MKX': 'Milwaukee', 'GRR': 'Grand Rapids', 'LSX': 'St. Louis',
    'EAX': 'Kansas City', 'DMX': 'Des Moines', 'MPX': 'Minneapolis', 'DLH': 'Duluth',
    'FSD': 'Sioux Falls', 'BIS': 'Bismarck', 'OAX': 'Omaha', 'FGF': 'Grand Forks',
    'FWD': 'Dallas/Fort Worth', 'HGX': 'Houston', 'EWX': 'San Antonio',
    'OUN': 'Oklahoma City', 'TSA': 'Tulsa', 'LZK': 'Little Rock',
    'LIX': 'New Orleans', 'SHV': 'Shreveport', 'LCH': 'Lake Charles',
    'BOU': 'Denver', 'PUB': 'Pueblo', 'GJT': 'Grand Junction', 'SLC': 'Salt Lake City',
    'BOI': 'Boise', 'BYZ': 'Billings', 'MSO': 'Missoula', 'RIW': 'Riverton',
    'PSR': 'Phoenix', 'VEF': 'Las Vegas', 'TWC': 'Tucson', 'FGZ': 'Flagstaff',
    'ABQ': 'Albuquerque', 'EPZ': 'El Paso',
    'LOX': 'Los Angeles', 'SGX': 'San Diego', 'MTR': 'San Francisco',
    'STO': 'Sacramento', 'HNX': 'Central California', 'EKA': 'Eureka',
    'SEW': 'Seattle', 'PQR': 'Portland', 'MFR': 'Medford', 'OTX': 'Spokane',
    'AFC': 'Anchorage', 'AFG': 'Fairbanks', 'HFO': 'Honolulu',
};

// IANA timezone for each office (all 68)
export const OFFICE_TIMEZONES = {
    // Northeast
    'OKX': 'America/New_York', 'BOX': 'America/New_York', 'PHI': 'America/New_York',
    'LWX': 'America/New_York', 'PBZ': 'America/New_York', 'BUF': 'America/New_York',
    'RAH': 'America/New_York', 'CHS': 'America/New_York',
    // Southeast
    'FFC': 'America/New_York', 'MFL': 'America/New_York', 'JAX': 'America/New_York',
    'TBW': 'America/New_York', 'MRX': 'America/New_York',
    'BMX': 'America/Chicago', 'OHX': 'America/Chicago', 'JAN': 'America/Chicago',
    // Great Lakes / Midwest
    'LOT': 'America/Chicago', 'DTX': 'America/Detroit', 'IND': 'America/Indiana/Indianapolis',
    'CLE': 'America/New_York', 'ILN': 'America/New_York', 'GRR': 'America/New_York',
    'MKX': 'America/Chicago', 'LSX': 'America/Chicago', 'EAX': 'America/Chicago',
    'DMX': 'America/Chicago',
    // Northern Plains
    'MPX': 'America/Chicago', 'DLH': 'America/Chicago', 'FSD': 'America/Chicago',
    'BIS': 'America/Chicago', 'OAX': 'America/Chicago', 'FGF': 'America/Chicago',
    // South Central
    'FWD': 'America/Chicago', 'HGX': 'America/Chicago', 'EWX': 'America/Chicago',
    'OUN': 'America/Chicago', 'TSA': 'America/Chicago', 'LZK': 'America/Chicago',
    'LIX': 'America/Chicago', 'SHV': 'America/Chicago', 'LCH': 'America/Chicago',
    // Rockies & Mountain West
    'BOU': 'America/Denver', 'PUB': 'America/Denver', 'GJT': 'America/Denver',
    'SLC': 'America/Denver', 'BOI': 'America/Boise', 'BYZ': 'America/Denver',
    'MSO': 'America/Denver', 'RIW': 'America/Denver',
    // Southwest
    'PSR': 'America/Phoenix', 'VEF': 'America/Los_Angeles', 'TWC': 'America/Phoenix',
    'FGZ': 'America/Phoenix', 'ABQ': 'America/Denver', 'EPZ': 'America/Denver',
    // Pacific
    'LOX': 'America/Los_Angeles', 'SGX': 'America/Los_Angeles', 'MTR': 'America/Los_Angeles',
    'STO': 'America/Los_Angeles', 'HNX': 'America/Los_Angeles', 'EKA': 'America/Los_Angeles',
    'SEW': 'America/Los_Angeles', 'PQR': 'America/Los_Angeles', 'MFR': 'America/Los_Angeles',
    'OTX': 'America/Los_Angeles',
    // Alaska & Pacific Islands
    'AFC': 'America/Anchorage', 'AFG': 'America/Anchorage', 'HFO': 'Pacific/Honolulu',
};

// Lat/lon coordinates for geolocation-based office selection
export const OFFICE_COORDS = {
    'OKX': [40.87, -72.86], 'BOX': [41.96, -71.14], 'PHI': [40.01, -74.81],
    'LWX': [38.97, -77.48], 'PBZ': [40.53, -80.22], 'BUF': [42.94, -78.74],
    'RAH': [35.87, -78.78], 'CHS': [32.90, -80.03], 'FFC': [33.36, -84.57],
    'MFL': [25.76, -80.38], 'JAX': [30.33, -81.69], 'TBW': [27.71, -82.40],
    'BMX': [33.17, -86.77], 'OHX': [36.25, -86.56], 'MRX': [36.17, -83.40],
    'JAN': [32.32, -90.08], 'LOT': [41.60, -88.09], 'DTX': [42.70, -83.47],
    'IND': [39.71, -86.28], 'CLE': [41.41, -81.86], 'ILN': [39.42, -83.82],
    'MKX': [42.97, -88.55], 'GRR': [42.89, -85.55], 'LSX': [38.70, -90.68],
    'EAX': [38.81, -94.26], 'DMX': [41.73, -93.72], 'MPX': [44.85, -93.57],
    'DLH': [46.84, -92.21], 'FSD': [43.59, -96.73], 'BIS': [46.77, -100.76],
    'OAX': [41.32, -96.37], 'FGF': [47.92, -97.10], 'FWD': [32.83, -97.30],
    'HGX': [29.47, -95.08], 'EWX': [29.70, -98.03], 'OUN': [35.24, -97.46],
    'TSA': [36.21, -95.87], 'LZK': [34.83, -92.26], 'LIX': [30.34, -89.83],
    'SHV': [32.45, -93.84], 'LCH': [30.12, -93.22], 'BOU': [39.99, -105.26],
    'PUB': [38.28, -104.62], 'GJT': [39.12, -108.53], 'SLC': [40.77, -111.96],
    'BOI': [43.56, -116.22], 'BYZ': [45.75, -108.57], 'MSO': [46.92, -114.09],
    'RIW': [43.07, -108.48], 'PSR': [33.46, -112.02], 'VEF': [36.05, -115.18],
    'TWC': [32.23, -110.95], 'FGZ': [35.23, -111.82], 'ABQ': [35.04, -106.62],
    'EPZ': [32.08, -106.62], 'LOX': [34.20, -119.20], 'SGX': [32.92, -117.11],
    'MTR': [36.60, -121.90], 'STO': [38.60, -121.37], 'HNX': [36.31, -119.63],
    'EKA': [40.80, -124.16], 'SEW': [47.69, -122.26], 'PQR': [45.56, -122.54],
    'MFR': [42.38, -122.87], 'OTX': [47.68, -117.63], 'AFC': [61.16, -150.02],
    'AFG': [64.84, -147.71], 'HFO': [21.30, -157.84],
};

// Office → US state abbreviation for the alerts API (all 68)
export const OFFICE_STATES = {
    // Northeast
    'OKX': 'NY', 'BOX': 'MA', 'PHI': 'PA', 'LWX': 'VA', 'PBZ': 'PA', 'BUF': 'NY',
    'RAH': 'NC', 'CHS': 'SC',
    // Southeast
    'FFC': 'GA', 'MFL': 'FL', 'JAX': 'FL', 'TBW': 'FL', 'BMX': 'AL', 'OHX': 'TN',
    'MRX': 'TN', 'JAN': 'MS',
    // Midwest
    'LOT': 'IL', 'DTX': 'MI', 'IND': 'IN', 'CLE': 'OH', 'ILN': 'OH', 'MKX': 'WI',
    'GRR': 'MI', 'LSX': 'MO', 'EAX': 'MO', 'DMX': 'IA',
    // Northern Plains
    'MPX': 'MN', 'DLH': 'MN', 'FSD': 'SD', 'BIS': 'ND', 'OAX': 'NE', 'FGF': 'ND',
    // South Central
    'FWD': 'TX', 'HGX': 'TX', 'EWX': 'TX', 'OUN': 'OK', 'TSA': 'OK', 'LZK': 'AR',
    'LIX': 'LA', 'SHV': 'LA', 'LCH': 'LA', 'EPZ': 'TX',
    // Rockies & Mountain West
    'BOU': 'CO', 'PUB': 'CO', 'GJT': 'CO', 'SLC': 'UT', 'BOI': 'ID', 'BYZ': 'MT',
    'MSO': 'MT', 'RIW': 'WY',
    // Southwest
    'PSR': 'AZ', 'VEF': 'NV', 'TWC': 'AZ', 'FGZ': 'AZ', 'ABQ': 'NM',
    // Pacific
    'LOX': 'CA', 'SGX': 'CA', 'MTR': 'CA', 'STO': 'CA', 'HNX': 'CA', 'EKA': 'CA',
    'SEW': 'WA', 'PQR': 'OR', 'MFR': 'OR', 'OTX': 'WA',
    // Alaska & Pacific Islands
    'AFC': 'AK', 'AFG': 'AK', 'HFO': 'HI',
};

// Office → sender-name fragment used to match alerts from the NWS API
export const OFFICE_SENDER = {
    // Northeast
    'OKX': 'New York', 'BOX': 'Boston', 'PHI': 'Mount Holly', 'LWX': 'Baltimore',
    'PBZ': 'Pittsburgh', 'BUF': 'Buffalo', 'RAH': 'Raleigh', 'CHS': 'Charleston',
    // Southeast
    'FFC': 'Peachtree', 'MFL': 'Miami', 'JAX': 'Jacksonville', 'TBW': 'Tampa Bay',
    'BMX': 'Birmingham', 'OHX': 'Nashville', 'MRX': 'Morristown', 'JAN': 'Jackson',
    // Midwest
    'LOT': 'Chicago', 'DTX': 'Detroit', 'IND': 'Indianapolis', 'CLE': 'Cleveland',
    'ILN': 'Wilmington', 'MKX': 'Milwaukee', 'GRR': 'Grand Rapids', 'LSX': 'St. Louis',
    'EAX': 'Kansas City', 'DMX': 'Des Moines',
    // Northern Plains
    'MPX': 'Twin Cities', 'DLH': 'Duluth', 'FSD': 'Sioux Falls', 'BIS': 'Bismarck',
    'OAX': 'Omaha', 'FGF': 'Grand Forks',
    // South Central
    'FWD': 'Fort Worth', 'HGX': 'Houston', 'EWX': 'San Antonio', 'OUN': 'Norman',
    'TSA': 'Tulsa', 'LZK': 'Little Rock', 'LIX': 'New Orleans', 'SHV': 'Shreveport',
    'LCH': 'Lake Charles', 'EPZ': 'El Paso',
    // Rockies & Mountain West
    'BOU': 'Denver', 'PUB': 'Pueblo', 'GJT': 'Grand Junction', 'SLC': 'Salt Lake City',
    'BOI': 'Boise', 'BYZ': 'Billings', 'MSO': 'Missoula', 'RIW': 'Riverton',
    // Southwest
    'PSR': 'Phoenix', 'VEF': 'Las Vegas', 'TWC': 'Tucson', 'FGZ': 'Flagstaff',
    'ABQ': 'Albuquerque', 'EPZ': 'El Paso',
    // Pacific
    'LOX': 'Los Angeles', 'SGX': 'San Diego', 'MTR': 'San Francisco', 'STO': 'Sacramento',
    'HNX': 'Hanford', 'EKA': 'Eureka', 'SEW': 'Seattle', 'PQR': 'Portland',
    'MFR': 'Medford', 'OTX': 'Spokane',
    // Alaska & Pacific Islands
    'AFC': 'Anchorage', 'AFG': 'Fairbanks', 'HFO': 'Honolulu',
};

// Canonical section-header mapping (raw NWS header → display name)
export const SECTION_NAMES = {
    'SYNOPSIS': 'Synopsis',
    'DISCUSSION': 'Discussion',
    'SHORT TERM': 'Short Term',
    'NEAR TERM': 'Short Term',
    'LONG TERM': 'Long Term',
    'EXTENDED': 'Long Term',
    'AVIATION': 'Aviation',
    'MARINE': 'Marine',
    'BEACHES': 'Beaches',
    'FIRE WEATHER': 'Fire Weather',
    'LOX WATCHES/WARNINGS/ADVISORIES': 'Active Alerts',
    'WATCHES/WARNINGS/ADVISORIES': 'Active Alerts',
    'KEY MESSAGES': 'Messages',
    'WHAT HAS CHANGED': 'What has changed',
    'MESSAGES': 'Messages',
};
