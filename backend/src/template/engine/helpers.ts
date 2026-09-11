import Handlebars from 'handlebars';

function toNumber(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(
      `currency helper received a non-numeric value: ${String(value)}`,
    );
  }

  return number;
}

function toDate(value: unknown): Date {
  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error(`date helper received an invalid date: ${String(value)}`);
  }

  return date;
}

export function registerTemplateHelpers(handlebars: typeof Handlebars): void {
  handlebars.registerHelper(
    'currency',
    (value: unknown, currency = 'USD', locale = 'en-US') => {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: String(currency),
      }).format(toNumber(value));
    },
  );

  handlebars.registerHelper('date', (value: unknown, locale = 'en-US') => {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(toDate(value));
  });

  handlebars.registerHelper('truncate', (value: unknown, maxLength: number) => {
    const text = String(value ?? '');
    const limit = Number(maxLength);

    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('truncate helper requires a positive integer maxLength');
    }

    if (text.length <= limit) {
      return text;
    }

    if (limit <= 3) {
      return text.slice(0, limit);
    }

    return `${text.slice(0, limit - 3).trimEnd()}...`;
  });
}
