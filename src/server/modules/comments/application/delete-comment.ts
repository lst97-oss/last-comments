export type DeleteCommentData = {
  siteKey: string
  commentId: string
  userId: string
}

export type DeleteCommentDeps<TResult> = {
  delete: (data: DeleteCommentData) => Promise<TResult>
}

export function deleteComment<TResult>(data: DeleteCommentData, deps: DeleteCommentDeps<TResult>): Promise<TResult> {
  return deps.delete(data)
}
