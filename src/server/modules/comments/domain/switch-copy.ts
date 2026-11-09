// The wording for each site switch and for a refused viewer, written once. The check before sign-in
// (http/feature-gate.ts) and the checks inside the writes (infrastructure) both read it, so one switch
// never gives two different messages.
const REACTIONS_FROM_BROWSERS = 'This site does not accept reactions from browsers'
const REACTION_REFUSAL = 'You cannot react on this site'

export const SWITCH_COPY = {
  votes: {
    off: 'Voting is turned off for this site',
    browsers: 'This site does not accept votes from browsers',
    refusal: 'You cannot vote on this site',
  },
  commentReactions: {
    off: 'Reactions are turned off for this site',
    browsers: REACTIONS_FROM_BROWSERS,
    refusal: REACTION_REFUSAL,
  },
  pageReactions: {
    off: 'Page reactions are turned off for this site',
    browsers: REACTIONS_FROM_BROWSERS,
    refusal: REACTION_REFUSAL,
  },
} as const
