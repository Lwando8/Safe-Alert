export interface Location {
  latitude: number;
  longitude: number;
}

export interface Friend {
  id: string;
  name: string;
  location: Location;
  lastUpdated: Date;
} 