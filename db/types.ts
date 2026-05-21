export type Trip = {
  id: number;
  datum: string;        // DD.MM.YYYY — display format
  datumIso: string;     // YYYY-MM-DD — used for sorting and filtering
  beginFahrt: string;   // HH:MM
  ankunftSchule: string; // HH:MM
  abfahrtSchule: string; // HH:MM
  endeFahrt: string;    // HH:MM
  gesamtzeit: number;   // minutes
  tourNr: string;
  besonderheiten: string | null;
  aufgezeichnetAm: string; // DD.MM.YYYY
};

export type NewTrip = Omit<Trip, 'id'>;

export type Settings = {
  fahrerName: string;
  unterschrift: string; // base64 PNG data URL, empty string if not set
  defaultBeginn: string;
  defaultAnkunft: string;
  defaultAbfahrt: string;
  defaultEnde: string;
  defaultTour: string;
  reminderEnabled: boolean;
  reminderTime: string; // HH:MM
  theme: 'light' | 'dark' | 'system';
};
