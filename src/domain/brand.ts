declare const brand: unique symbol;

/**
 * A branded type: at runtime a plain `T`, at compile time distinct from every
 * other `T`. A value gets its brand only from the validating constructor
 * function of its type, so holding one means it has been checked.
 *
 * The brand exists only for the type checker; values stay serialisable.
 */
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };
