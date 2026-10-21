export function canCreateInitialAdmin(userCount: number, adminCount: number): boolean {
  return userCount === 0 && adminCount === 0
}
