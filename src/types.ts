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
}

export interface ExhibitData {
  exhibitTitle: string;
  artifacts: Artifact[];
}
