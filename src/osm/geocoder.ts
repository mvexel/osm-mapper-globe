import axios from "axios";

// Cache for geocoding results to be nice to Nominatim
const geoCache = new Map<string, string>();

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<string> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (geoCache.has(key)) {
    return geoCache.get(key)!;
  }

  try {
    // call nominatim for rev geo
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
    const response = await axios.get(url, {
      headers: {
        // Heathcliff, it's me, I'm Martijn
        "User-Agent": "ThankAMapper/1.0 (m@rtijn.org)",
      },
    });

    const address = response.data.address;
    let location = "Unknown Location";

    if (address) {
      const city =
        address.city || address.town || address.village || address.county;
      const country = address.country;
      if (city && country) {
        location = `${city}, ${country}`;
      } else if (country) {
        location = `${country}`;
      }
    }

    geoCache.set(key, location);
    return location;
  } catch (error) {
    console.error("Geocoding error:", error);
    return "Unknown Location";
  }
}
