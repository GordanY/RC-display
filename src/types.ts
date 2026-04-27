export type DisplayMode = 'name-school' | 'school-name';

export interface Creation {
  id: string;
  name: string;
  school: string;
  displayMode: DisplayMode;
  preview: string;
  model: string;
  texture?: string;
  mtl?: string;
}

export interface Artifact {
  id: string;
  title: string;
  description: string;
  model: string;
  texture?: string;
  mtl?: string;
  creations: Creation[];
  // Absent or true => shown on kiosk; false => hidden but kept on disk.
  visible?: boolean;
}

export interface ExhibitData {
  exhibitTitle: string;
  artifacts: Artifact[];
}
