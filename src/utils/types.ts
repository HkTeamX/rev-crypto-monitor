export type MaybePromise<T> = Promise<T> | T

export type StringKeys<T> = Extract<keyof T, string>

export type Oneof<T extends unknown[]> = T[number]

export type PathKeys<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}` | `${K}.${PathKeys<T[K]>}`
        : `${K}`;
    }[keyof T & string]
  : never
