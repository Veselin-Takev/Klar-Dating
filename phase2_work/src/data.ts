export interface Profile { isVerified?: boolean;
  id: string;
  name: string;
  age: number;
  location: string;
  bio: string;
  photoUrl: string;
  interests: string[];
  values?: string[];
  personalityTraits?: string[];
}

export const allProfiles: Profile[] = [];
