/**
 * 가족 코드는 Firestore 문서 경로(families/{코드})로 쓰이므로
 * 경로에 쓸 수 없는 값이면 연결이 실패한다. 문제가 있으면 안내 문구를, 없으면 null을 돌려준다.
 */
export function familyCodeProblem(code: string): string | null {
  const c = code.trim()
  if (c.length < 6) return '6글자 이상 입력해 주세요.'
  if (/[/\\]/.test(c)) return '/ 와 \\ 는 쓸 수 없어요.'
  if (/^__.*__$/.test(c)) return '앞뒤에 __ 를 붙인 코드는 쓸 수 없어요.'
  if (c.length > 100) return '100글자 이하로 입력해 주세요.'
  return null
}
