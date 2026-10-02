import { validate, type State } from "./state";
import { SaveQueue } from './saveQueue';
// 第一张正式地图从新档开始，旧数据库保留供原版本读取或导出。
export const SAVE_DATABASE = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('combatSlice') ? 'farwind-combat-slice-isolated' : import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('runeLab') ? 'farwind-rune-lab-isolated' : import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('combatFeel')
  ? 'farwind-combat-feel-isolated' : 'farwind-first-map';
let fault = { delay: 0, failures: 0 };
// 只在显式开发样板使用；生产构建无法启用故障注入。
export function configureSaveFault(delay = 0, failures = 0) {
  if (!import.meta.env.DEV) throw Error('生产环境不提供保存故障注入。');
  fault = { delay: Math.max(0, Math.min(1000, delay)), failures: Math.max(0, Math.min(10, failures)) };
}
async function db() {
  return new Promise<IDBDatabase>((ok, no) => {
    const r = indexedDB.open(SAVE_DATABASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("states");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}
async function writeSave(s: State) {
  if (import.meta.env.DEV) {
    const delay = fault.delay;
    if (delay) await new Promise(ok => setTimeout(ok, delay));
    if (fault.failures > 0) { fault.failures--; throw Error('开发注入保存失败；上一份有效存档仍保留。'); }
  }
  const clean = s, d = await db();
  return new Promise<void>((ok, no) => {
    const t = d.transaction("states", "readwrite");
    t.oncomplete = () => {
      d.close();
      ok();
    };
    t.onerror = t.onabort = () => {
      d.close();
      no(Error("保存失败，上一份有效存档仍保留，请导出备份。"));
    };
    try{
      const store=t.objectStore('states'),old=store.get('current');
      old.onsuccess=()=>{if(old.result&&old.result.schema_version<15){const previous=store.get('before-combat-build');previous.onsuccess=()=>{if(!previous.result)store.put(old.result,'before-combat-build');};}if(old.result&&old.result.schema_version<16){const backup=store.get('before-aiming-scope');backup.onsuccess=()=>{if(!backup.result)store.put(old.result,'before-aiming-scope');};}if(old.result&&old.result.schema_version<20){const backup=store.get('before-cat-companion');backup.onsuccess=()=>{if(!backup.result)store.put(old.result,'before-cat-companion');};}store.put(clean,'current');};
    }
    catch(e){t.abort();d.close();no(e);}
  });
}
export async function load() {
  await queue.barrier();
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
const queue = new SaveQueue(writeSave);
export function save(s: State, options: { automatic?: boolean; captured?: (snapshot: State) => void } = {}) { return queue.enqueue(s, options.automatic, options.captured); }
export const saveBarrier = () => queue.barrier();
export const markSaveDirty = () => queue.markDirty();
export const switchSaveSession = () => queue.switchSession();
export const saveDiagnostic = () => queue.snapshot();

export async function migrationBackup(){
 await queue.barrier();const d=await db();
 return new Promise<unknown>((ok,no)=>{const t=d.transaction('states','readonly'),r=t.objectStore('states').get('before-cat-companion');r.onsuccess=()=>{if(r.result)ok(r.result);else {const older=t.objectStore('states').get('before-aiming-scope');older.onsuccess=()=>{if(older.result)ok(older.result);else{const first=t.objectStore('states').get('before-combat-build');first.onsuccess=()=>ok(first.result??null);first.onerror=()=>no(first.error);}};older.onerror=()=>no(older.error);}};r.onerror=()=>no(r.error);t.oncomplete=()=>d.close();});
}
