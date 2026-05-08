import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Search, 
  Navigation, 
  Phone, 
  Clock, 
  ExternalLink, 
  Star,
  Loader2,
  Map as MapIcon,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

export default function ClinicLocator() {
  const [searchQuery, setSearchQuery] = useState('');
  const [clinics, setClinics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [groundingMetadata, setGroundingMetadata] = useState<any[]>([]);

  useEffect(() => {
    // Get user location on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
        }
      );
    }
  }, []);

  const findClinics = async () => {
    if (!searchQuery.trim() && !userLocation) return;
    
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";

      const prompt = searchQuery.trim() 
        ? `Find clinics or medical centers related to "${searchQuery}" near my location.`
        : "Find the nearest high-rated medical clinics and hospitals to my current location.";

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: userLocation ? {
                latitude: userLocation.lat,
                longitude: userLocation.lng
              } : undefined
            }
          }
        }
      });

      // Extract results from grounding metadata
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      setGroundingMetadata(chunks);

      // Parse the response text to get a list of clinics
      // Since Google Maps grounding returns a text response with references, 
      // we'll use the text as the primary source and the chunks for links.
      
      // For a better UI, we'll try to extract structured info if possible, 
      // but the text response is the most reliable.
      setClinics([{
        id: 'results',
        text: response.text,
        links: chunks.filter((c: any) => c.maps?.uri).map((c: any) => ({
          title: c.maps.title,
          url: c.maps.uri
        }))
      }]);

    } catch (error) {
      console.error("Clinic search failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-emerald-600 font-bold text-[10px] uppercase tracking-[0.2em]">
          <MapPin size={14} />
          Google Maps Integration
        </div>
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Clinic Locator</h2>
        <p className="text-slate-500 font-medium">Find specialized care and medical facilities near you using AI-powered location intelligence.</p>
      </header>

      <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && findClinics()}
              placeholder="Search for 'Cardiologists', 'Pediatricians', or 'Urgent Care'..."
              className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-3xl focus:ring-2 focus:ring-blue-600 transition-all font-semibold text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <button 
            onClick={findClinics}
            disabled={isLoading}
            className="px-10 py-5 bg-blue-600 text-white rounded-3xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Navigation size={24} />}
            {isLoading ? 'Searching...' : 'Find Care'}
          </button>
        </div>

        {!userLocation && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 text-sm font-medium">
            <Info size={18} className="shrink-0" />
            Location access is disabled. Search results may be less accurate.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="text-blue-600 animate-spin" size={48} />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Consulting Google Maps...</p>
              </div>
            ) : clinics.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {clinics.map((result) => (
                  <div key={result.id} className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm space-y-6">
                    <div className="prose prose-slate max-w-none">
                      <div className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                        {result.text}
                      </div>
                    </div>

                    {result.links.length > 0 && (
                      <div className="pt-6 border-t border-slate-50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Verified Locations</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {result.links.map((link: any, i: number) => (
                            <a 
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-blue-50 transition-all group"
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                                  <MapPin size={20} />
                                </div>
                                <span className="font-bold text-slate-700 text-sm truncate">{link.title}</span>
                              </div>
                              <ExternalLink size={16} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-20 bg-white rounded-[40px] border border-slate-50 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <MapIcon size={40} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Search for Clinics</h3>
                <p className="text-slate-500 text-sm">Enter a specialty or location to find the best care near you.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-emerald-600 rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl shadow-emerald-200">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Navigation size={120} />
            </div>
            <div className="relative z-10">
              <h4 className="text-2xl font-bold mb-4">Location Intelligence</h4>
              <p className="text-emerald-100 text-sm leading-relaxed mb-8 font-medium">
                Pulse Health uses Google Maps grounding to provide verified, real-time information about medical facilities, including ratings, hours, and direct navigation.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                    <Star size={16} />
                  </div>
                  <span className="text-xs font-bold text-emerald-50 uppercase tracking-widest">Verified Ratings</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                    <Clock size={16} />
                  </div>
                  <span className="text-xs font-bold text-emerald-50 uppercase tracking-widest">Real-time Hours</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                    <Phone size={16} />
                  </div>
                  <span className="text-xs font-bold text-emerald-50 uppercase tracking-widest">Direct Contact</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-slate-900">Popular Searches</h3>
            <div className="flex flex-wrap gap-2">
              {['Urgent Care', 'Cardiology', 'Pediatrics', 'Dentists', 'Pharmacies', 'Hospitals'].map((tag) => (
                <button 
                  key={tag}
                  onClick={() => {
                    setSearchQuery(tag);
                    // Trigger search manually or via useEffect if needed
                  }}
                  className="px-4 py-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl text-xs font-bold transition-all border border-transparent hover:border-blue-100"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
