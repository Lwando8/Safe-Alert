/**
 * In-memory Firestore stand-in for Phase 2B unit tests.
 * Not a full emulator — covers membership / identity / incident query semantics.
 */

type DocData = Record<string, unknown>;

export class MemoryDb {
  private collections = new Map<string, Map<string, DocData>>();

  collection(name: string) {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    const col = this.collections.get(name)!;
    const self = this;
    return {
      doc(id?: string) {
        const docId = id || `auto_${Math.random().toString(36).slice(2, 10)}`;
        return self.docRef(name, docId);
      },
      where(field: string, op: string, value: unknown) {
        return self.query(name, [{ field, op, value }]);
      },
    };
  }

  doc(path: string) {
    const [col, id, ...rest] = path.split('/');
    if (rest.length) {
      // nested path incidents/x/timeline/y → treat as flat key for tests when needed
      return this.docRef(path.split('/').slice(0, -1).join('/'), path.split('/').pop()!);
    }
    return this.docRef(col!, id!);
  }

  private docRef(collectionName: string, id: string) {
    if (!this.collections.has(collectionName)) this.collections.set(collectionName, new Map());
    const col = this.collections.get(collectionName)!;
    const self = this;
    return {
      id,
      async get() {
        const data = col.get(id);
        return {
          id,
          exists: !!data,
          data: () => data,
          ref: self.docRef(collectionName, id),
        };
      },
      async set(data: DocData, opts?: { merge?: boolean }) {
        const prev = col.get(id) || {};
        col.set(id, opts?.merge ? { ...prev, ...data } : { ...data });
      },
      async update(data: DocData) {
        const prev = col.get(id);
        if (!prev) throw Object.assign(new Error('not-found'), { code: 5 });
        col.set(id, { ...prev, ...data });
      },
      async create(data: DocData) {
        if (col.has(id)) throw Object.assign(new Error('already-exists'), { code: 6 });
        col.set(id, { ...data });
      },
    };
  }

  private query(collectionName: string, filters: Array<{ field: string; op: string; value: unknown }>) {
    const self = this;
    const state = {
      filters,
      orderField: null as string | null,
      orderDir: 'asc' as 'asc' | 'desc',
      limitN: 100,
    };

    const api = {
      where(field: string, op: string, value: unknown) {
        state.filters.push({ field, op, value });
        return api;
      },
      orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
        state.orderField = field;
        state.orderDir = dir;
        return api;
      },
      limit(n: number) {
        state.limitN = n;
        return api;
      },
      async get() {
        if (!self.collections.has(collectionName)) self.collections.set(collectionName, new Map());
        let docs = [...self.collections.get(collectionName)!.entries()].map(([id, data]) => ({
          id,
          data: () => data,
          ref: self.docRef(collectionName, id),
        }));

        for (const f of state.filters) {
          docs = docs.filter(d => {
            const v = (d.data() as DocData)[f.field];
            if (f.op === '==') return v === f.value;
            if (f.op === '!=') return v !== f.value;
            return false;
          });
        }

        if (state.orderField) {
          const field = state.orderField;
          docs.sort((a, b) => {
            const av = (a.data() as DocData)[field] as number;
            const bv = (b.data() as DocData)[field] as number;
            return state.orderDir === 'asc' ? av - bv : bv - av;
          });
        }

        docs = docs.slice(0, state.limitN);
        return {
          empty: docs.length === 0,
          size: docs.length,
          docs,
        };
      },
    };
    return api;
  }
}
