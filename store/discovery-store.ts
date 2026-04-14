import { create } from 'zustand';
import type { Listing } from '@/db/schema';

export type ViewMode = 'list' | 'map';

interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface DiscoveryStore {
  viewMode: ViewMode;
  searchQuery: string;
  activeFilters: string[];
  mapRegion: MapRegion | null;
  listings: Listing[];
  selectedListingId: number | null;
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  toggleFilter: (filter: string) => void;
  setMapRegion: (region: MapRegion) => void;
  setListings: (listings: Listing[]) => void;
  setSelectedListingId: (id: number | null) => void;
}

export const useDiscoveryStore = create<DiscoveryStore>((set, get) => ({
  viewMode: 'list',
  searchQuery: '',
  activeFilters: [],
  mapRegion: null,
  listings: [],
  selectedListingId: null,
  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleFilter: (filter) => {
    const current = get().activeFilters;
    const updated = current.includes(filter)
      ? current.filter((f) => f !== filter)
      : [...current, filter];
    set({ activeFilters: updated });
  },
  setMapRegion: (region) => set({ mapRegion: region }),
  setListings: (listings) => set({ listings }),
  setSelectedListingId: (id) => set({ selectedListingId: id }),
}));
