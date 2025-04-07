export default function streamTsv<I, K extends string, O extends Record<K, string | number | null | undefined>>(
  columns: K[],
  items: AsyncIterable<I> | I[],
  itemTransform: (item: I) => O | null | undefined
) {
  const encoder = new TextEncoder();
  const iterator = Symbol.asyncIterator in items ? items[Symbol.asyncIterator]() : (function* () {
    return (items as I[])[Symbol.iterator]();
  })();

  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(columns.join('\t') + '\n'));
    },
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }
      const transformed = itemTransform(value);
      if (transformed) {
        const row = columns.map(col => `${transformed[col] ?? ''}`).join('\t') + '\n';
        controller.enqueue(encoder.encode(row));
      }
    }
  });
}
