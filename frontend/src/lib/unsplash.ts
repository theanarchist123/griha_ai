const UNSPLASH_ACCESS_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
const UNSPLASH_BASE = "https://api.unsplash.com";

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string | null;
  user: {
    name: string;
    links: { html: string };
  };
}

export async function fetchPropertyImages(
  query: string = "apartment india interior",
  count: number = 6
): Promise<string[]> {
  if (!UNSPLASH_ACCESS_KEY) {
    return Array(count).fill("/placeholder-property.jpg");
  }
  try {
    const res = await fetch(
      `${UNSPLASH_BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );
    const data = await res.json();
    return data.results.map((p: UnsplashPhoto) => p.urls.regular);
  } catch {
    return Array(count).fill("/placeholder-property.jpg");
  }
}

export async function fetchCityImage(city: string): Promise<string> {
  if (!UNSPLASH_ACCESS_KEY) {
    return "/placeholder-city.jpg";
  }
  try {
    const res = await fetch(
      `${UNSPLASH_BASE}/search/photos?query=${encodeURIComponent(city + " skyline india")}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );
    const data = await res.json();
    return data.results[0]?.urls?.regular || "/placeholder-city.jpg";
  } catch {
    return "/placeholder-city.jpg";
  }
}

export function getUnsplashUrl(query: string, width: number = 1200, height: number = 800): string {
  return `https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=${width}&h=${height}&fit=crop&q=80`;
}

// Static fallback images for when API is not configured
export const STATIC_IMAGES = {
  heroMumbai: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1920&h=1080&fit=crop&q=80",
  apartment1: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop&q=80",
  apartment2: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop&q=80",
  apartment3: "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop&q=80",
  apartment4: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop&q=80",
  apartment5: "https://images.unsplash.com/photo-1560185008-b033106af5c8?w=800&h=600&fit=crop&q=80",
  apartment6: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop&q=80",
  interior1: "https://images.unsplash.com/photo-1616137466211-f736a1ef5ce6?w=800&h=600&fit=crop&q=80",
  interior2: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop&q=80",
  interior3: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop&q=80",
  interior4: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop&q=80",
  locality1: "https://images.unsplash.com/photo-1567157577867-05ccb1388e13?w=800&h=600&fit=crop&q=80",
  locality2: "https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=800&h=600&fit=crop&q=80",
  onboarding1: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&h=1200&fit=crop&q=80",
  onboarding2: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&h=1200&fit=crop&q=80",
  onboarding3: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=1200&fit=crop&q=80",
  onboarding4: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=1200&fit=crop&q=80",
  onboarding5: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&h=1200&fit=crop&q=80",
};
