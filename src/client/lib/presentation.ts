export const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(value.length === 10 ? `${value}T12:00:00` : value),
      )
    : 'Not set';
