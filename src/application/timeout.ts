/**
 * Gives up on a call that does not answer in time: resolves with `onTimeout`
 * instead. The call itself is not cancelled; its late answer is ignored.
 */
export function withTimeout<T>(
  call: Promise<T>,
  ms: number,
  onTimeout: T,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(onTimeout), ms);
    call.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
