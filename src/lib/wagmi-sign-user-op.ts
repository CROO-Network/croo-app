/** `personal_sign` payload for prepared UserOp hash (matches backend `SignUserOpPersonal`). */
export function userOpHashSignMessageArgs(userOpHash: string) {
  return { message: { raw: userOpHash as `0x${string}` } } as const;
}
