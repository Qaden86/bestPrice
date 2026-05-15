export type TraceStep =
  // lifecycle
  | 'start'
  | 'navigation'

  // extraction layer
  | 'pdp.extract'
  | 'cart.click'
  | 'cart.extract'

  // validation layer
  | 'validation'

  // system
  | 'error'
  | 'retry';