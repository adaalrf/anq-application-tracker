export function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    folder: 'M3 6h7l2 3h9v12H3z M3 6V3h7l2 3h7v3',
    clock: 'M12 7v6l4 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    journal: 'M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5',
    plus: 'M12 5v14 M5 12h14',
    arrow: 'M5 12h14 M14 7l5 5-5 5',
    search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
    close: 'M6 6l12 12 M6 18L18 6',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.folder} />
    </svg>
  );
}
