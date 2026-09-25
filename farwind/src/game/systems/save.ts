import { validate, type State } from "./state";
async function db() {
  return new Promise<IDBDatabase>((ok, no) => {
    const r = indexedDB.open("farwind-save", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("states");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}
async function writeSave(s: State) {
  const clean = validate(s),
    d = await db();
  return new Promise<void>((ok, no) => {
    const t = d.transaction("states", "readwrite");
    t.objectStore("states").put(clean, "current");
    t.oncomplete = () => {
      d.close();
      ok();
    };
    t.onerror = t.onabort = () => {
      d.close();
      no(Error("保存失败，上一份有效存档仍保留，请导出备份。"));
    };
  });
}
export async function load() {
  const d = await db();
  return new Promise<State | null>((ok, no) => {
    const t = d.transaction("states", "readonly"),
      r = t.objectStore("states").get("current");
    r.onsuccess = () => {
      try {
        ok(r.result ? validate(r.result) : null);
      } catch (e) {
        no(e);
      }
    };
    r.onerror = () => no(r.error);
    t.oncomplete = () => d.close();
  });
}

// 串行提交调用时的快照，失败不会阻断后续保存，也不会先删除旧档。
let pending: Promise<void> = Promise.resolve();
export function save(s: State) {
  const snapshot = validate(s);
  const current = pending.then(() => writeSave(snapshot));
  pending = current.catch(() => {});
  return current;
}
