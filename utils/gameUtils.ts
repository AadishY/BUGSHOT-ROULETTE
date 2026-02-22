export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number;
  return function(this: any, ...args: any[]) {
    const context = this;
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function() {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  } as T;
}
