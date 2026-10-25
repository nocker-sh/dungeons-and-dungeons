/** 書き換えられる写し。ユースケースの中だけで使い、返すときは読み取り専用に戻す。 */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] }
