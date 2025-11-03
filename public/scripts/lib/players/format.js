const createNumberFormatter = (options) => new Intl.NumberFormat(undefined, options);
const integerFormatter = createNumberFormatter({ maximumFractionDigits: 0 });
const oneDecimalFormatter = createNumberFormatter({ minimumFractionDigits: 1, maximumFractionDigits: 1 });
export function formatInteger(value) {
    if (value == null || Number.isNaN(value)) {
        return "—";
    }
    return integerFormatter.format(Math.round(value));
}
export function formatDecimal(value, digits = 1) {
    if (value == null || Number.isNaN(value)) {
        return "—";
    }
    if (digits === 1) {
        return oneDecimalFormatter.format(value);
    }
    const formatter = createNumberFormatter({ minimumFractionDigits: digits, maximumFractionDigits: digits });
    return formatter.format(value);
}
export function formatPercent(value) {
    if (value == null || Number.isNaN(value)) {
        return "—";
    }
    return `${formatDecimal(value * 100, 1)}%`;
}
