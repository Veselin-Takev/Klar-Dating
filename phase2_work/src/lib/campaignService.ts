export interface MunichCampaign {
  id: string;
  title: string;
  tagline: string;
  targetInterests: string[];
  activeFrom: string;
  activeUntil: string;
}

export const ACTIVE_MUNICH_CAMPAIGNS: MunichCampaign[] = [
  {
    id: 'oktoberfest-2026',
    title: 'Wiesn-Spezial 2026',
    tagline: 'Finde deine Begleitung für das Oktoberfest – ohne oberflächliche Auswahlmechanik.',
    targetInterests: ['Oktoberfest', 'Kultur', 'Reisen'],
    activeFrom: '2026-09-01',
    activeUntil: '2026-10-05',
  },
  {
    id: 'munich-vegan-fall',
    title: 'Green Munich Meetups',
    tagline: 'Entdecke die besten veganen Spots in München bei echten Dates.',
    targetInterests: ['Vegan', 'Kochen', 'Sport'],
    activeFrom: '2026-09-15',
    activeUntil: '2026-11-30',
  }
];

export function getActiveCampaignsForUser(userInterests: string[]): MunichCampaign[] {
  const dateStr = new Date().toISOString().split('T')[0];
  const currentDate = dateStr || '';
  
  return ACTIVE_MUNICH_CAMPAIGNS.filter(campaign => {
    const isDateValid = currentDate !== '' && currentDate >= campaign.activeFrom && currentDate <= campaign.activeUntil;
    const hasMatchingInterest = campaign.targetInterests.some(interest => userInterests.includes(interest));
    return isDateValid && hasMatchingInterest;
  });
}
