import type { getBusinessDb } from '@/server/db/business-sql'

export type Db = ReturnType<typeof getBusinessDb>

export type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]

export type VoteValue = -1 | 1

export type CommentVoteSummary = { score: number; viewerVote: VoteValue | null }
