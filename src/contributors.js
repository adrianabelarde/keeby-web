/** Community sample contributors — X profile URLs verified for Keeby attribution. */
export const SWITCH_CONTRIBUTORS = {
  'akko-piano-pro': {
    name: 'Alice',
    handle: 'aliceinnny',
    profileUrl: 'https://x.com/aliceinnny',
  },
  'keychron-k2-max-brown': {
    name: 'Himanshu',
    handle: 'himanhacks',
    profileUrl: 'https://x.com/himanhacks',
    avatar: '/himanshu.webp',
  },
  'iqunix-mq80': {
    name: 'Alex',
    handle: 'aliszu',
    profileUrl: 'https://x.com/aliszu',
  },
}

export function contributorForProfile(profileId) {
  return SWITCH_CONTRIBUTORS[profileId] ?? null
}
