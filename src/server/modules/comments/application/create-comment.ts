import { type CommentValidationInput, EMPTY_SCREENING, type ScreenVerdict } from '@/server/plugins/comment-plugins'

export type CreateCommentData = {
  siteKey: string
  pageUrl: string
  pageKey?: string
  title?: string
  parentId?: string
  userId: string | null
  authorName: string
  bodyMarkdown: string
  verificationToken?: string
}

export type CommentCreationContext = Pick<CommentValidationInput, 'siteId' | 'pageUrl'> & { pageKey?: string }

export type CreateCommentDeps<TResult> = {
  prepare: (data: CreateCommentData) => Promise<CommentCreationContext>
  validate: (input: CommentValidationInput) => Promise<void>
  screen?: (input: CommentValidationInput) => Promise<ScreenVerdict>
  persist: (data: CreateCommentData, context: CommentCreationContext, screening: ScreenVerdict) => Promise<TResult>
}

export async function createComment<TResult>(
  data: CreateCommentData,
  deps: CreateCommentDeps<TResult>,
): Promise<TResult> {
  const context = await deps.prepare(data)
  const validationInput: CommentValidationInput = {
    ...context,
    userId: data.userId,
    authorName: data.authorName,
    bodyMarkdown: data.bodyMarkdown,
    verificationToken: data.verificationToken,
    ...(data.parentId === undefined ? {} : { parentId: data.parentId }),
  }
  await deps.validate(validationInput)
  const screening = await (deps.screen ? deps.screen(validationInput) : EMPTY_SCREENING)
  return deps.persist(data, context, screening)
}
