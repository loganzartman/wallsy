export function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timeout: number;
  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  }) as T;
}
