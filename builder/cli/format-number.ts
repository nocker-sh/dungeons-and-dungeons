export const formatNumber = (value: number, digits = 1) =>
  Number.isNaN(value) ? "-" : value.toFixed(digits)
