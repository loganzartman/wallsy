/** leading-edge debounce */
export function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let wait: number | undefined;
  let pendingArgs: Parameters<T> | undefined;

  const startWait = () => {
    wait = setTimeout(() => {
      wait = undefined;
      if (pendingArgs !== undefined) {
        func(...pendingArgs);
        pendingArgs = undefined;
        startWait();
      }
    }, delay);
  };

  return ((...args: Parameters<T>) => {
    if (wait === undefined) {
      func(...args);
      startWait();
      return;
    }

    pendingArgs = args;
  }) as T;
}
