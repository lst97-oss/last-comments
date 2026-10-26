export type ModerationViewState = {
  /** The site the admin picked; null falls back to the first site. */
  siteOverride: string | null
  recentDays: number
  takedownPage: number
}

export type ModerationViewAction =
  | { type: 'switchSite'; site: string }
  | { type: 'siteCreated'; site: string }
  | { type: 'siteCleared' }
  | { type: 'recentDays'; days: number }
  | { type: 'takedownPage'; page: number }

export const INITIAL_MODERATION_VIEW: ModerationViewState = { siteOverride: null, recentDays: 7, takedownPage: 0 }

// Every change of site or window invalidates the takedown page index, so those actions reset it in the same
// update rather than each call site remembering to.
export function moderationViewReducer(state: ModerationViewState, action: ModerationViewAction): ModerationViewState {
  switch (action.type) {
    case 'switchSite':
    case 'siteCreated':
      return { ...state, siteOverride: action.site, takedownPage: 0 }
    case 'siteCleared':
      return { ...state, siteOverride: null, takedownPage: 0 }
    case 'recentDays':
      return { ...state, recentDays: action.days, takedownPage: 0 }
    case 'takedownPage':
      return { ...state, takedownPage: action.page }
  }
}
