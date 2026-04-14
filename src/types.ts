export interface BilingualText {
  zh: string;
  en: string;
}

export interface Creation {
  id: string;
  title: BilingualText;
  artist: BilingualText;
  description: BilingualText;
  photos: string[];
  video?: string;
  model?: string;
}

export interface Artifact {
  id: string;
  name: BilingualText;
  period: BilingualText;
  description: BilingualText;
  originalPhoto: string;
  model?: string;
  creations: Creation[];
}

export interface ExhibitData {
  artifacts: Artifact[];
}

export type Language = 'zh' | 'en';

export type ContentView = 'info' | 'model' | 'comparison' | 'video';
