export type EditCommentData = {
  siteKey: string
  commentId: string
  userId: string | null
  bodyMarkdown: string
  editKey?: string
  anonWindowMinutes?: number
}

export type EditCommentDeps<TResult> = {
  edit: (data: EditCommentData) => Promise<TResult>
}

export function editComment<TResult>(data: EditCommentData, deps: EditCommentDeps<TResult>): Promise<TResult> {
  return deps.edit(data)
}
