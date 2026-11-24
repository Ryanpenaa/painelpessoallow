/** Cotação manual de referência para os gastos em anúncios. */
export const USD_BRL_RATE = 6.20;

/** Converte apenas contas em USD para BRL; demais moedas mantêm sua unidade. */
export function formatCurrencyInBRL(value: number, currency = "BRL"): string {
  const isUSD = currency.toUpperCase() === "USD";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: isUSD ? "BRL" : currency,
    maximumFractionDigits: 2,
  }).format(isUSD ? value * USD_BRL_RATE : value);
}
