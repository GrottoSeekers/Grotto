import { create } from 'zustand';
import type { Listing } from '@/db/schema';

export type ViewMode = 'list' | 'map';
export type SortBy = 'recommended' | 'newest' | 'start_date';

interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface DiscoveryStore {
  viewMode: ViewMode;
  // Search
  searchQuery: string;
  dateFrom: string | null;   // YYYY-MM-DD
  dateTo: string | null;     // YYYY-MM-DD
  // Filters
  sortBy: SortBy;
  petFilters: string[];      // [] = all; ['dog','cat'] = OR match
  minNights: number;         // 0 = any
  amenityFilters: string[];  // all must match (AND)
  // Map
  mapRegion: MapRegion | null;
  // Data
  listings: Listing[];
  selectedListingId: number | null;
  // Actions
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  setSortBy: (sortBy: SortBy) => void;
  setPetFilters: (filters: string[]) => void;
  setMinNights: (nights: number) => void;
  setAmenityFilters: (filters: string[]) => void;
  setMapRegion: (region: MapRegion) => void;
  setListings: (listings: Listing[]) => void;
  setSelectedListingId: (id: number | null) => void;
  clearFilters: () => void;
}

export const useDiscoveryStore = create<DiscoveryStore>((set) => ({
  viewMode: 'list',
  searchQuery: '',
  dateFrom: null,
  dateTo: null,
  sortBy: 'recommended',
  petFilters: [],
  minNights: 0,
  amenityFilters: [],
  mapRegion: null,
  listings: [],
  selectedListingId: null,
  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
  setSortBy: (sortBy) => set({ sortBy }),
  setPetFilters: (filters) => set({ petFilters: filters }),
  setMinNights: (nights) => set({ minNights: nights }),
  setAmenityFilters: (filters) => set({ amenityFilters: filters }),
  setMapRegion: (region) => set({ mapRegion: region }),
  setListings: (listings) => set({ listings }),
  setSelectedListingId: (id) => set({ selectedListingId: id }),
  clearFilters: () => set({
    searchQuery: '',
    dateFrom: null,
    dateTo: null,
    sortBy: 'recommended',
    petFilters: [],
    minNights: 0,
    amenityFilters: [],
  }),
}));
