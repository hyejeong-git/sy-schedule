import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  type Firestore,
} from 'firebase/firestore'

export type Col = 'events' | 'academies' | 'sessions' | 'meals' | 'settings'
type Doc = { id: string } & Record<string, unknown>

export interface Backend {
  /** 변경될 때마다 해당 컬렉션의 전체 목록을 전달한다 */
  subscribe(col: Col, cb: (items: Doc[]) => void): () => void
  put(col: Col, item: Doc): Promise<void>
  remove(col: Col, id: string): Promise<void>
}

/** Firebase 설정이 .env에 들어 있는지 */
export const firebaseConfigured = Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID)

/** 프로젝트 안에 JSON으로 저장 못 하는 undefined 값을 제거한다 */
const clean = <T extends object>(o: T): T => JSON.parse(JSON.stringify(o))

/** Firebase 없이 이 기기에서만 저장 (개발·체험용) */
export function createLocalBackend(): Backend {
  const listeners = new Map<Col, Set<(items: Doc[]) => void>>()
  const read = (col: Col): Doc[] => JSON.parse(localStorage.getItem(`sy:${col}`) ?? '[]')
  const write = (col: Col, items: Doc[]) => {
    localStorage.setItem(`sy:${col}`, JSON.stringify(items))
    listeners.get(col)?.forEach((cb) => cb(items))
  }
  return {
    subscribe(col, cb) {
      const set = listeners.get(col) ?? new Set()
      set.add(cb)
      listeners.set(col, set)
      cb(read(col))
      return () => set.delete(cb)
    },
    async put(col, item) {
      const items = read(col).filter((x) => x.id !== item.id)
      write(col, [...items, clean(item)])
    },
    async remove(col, id) {
      write(col, read(col).filter((x) => x.id !== id))
    },
  }
}

/** Firestore: families/{가족코드}/{컬렉션}/{id} */
export async function createFirebaseBackend(familyCode: string): Promise<Backend> {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })
  await signInAnonymously(getAuth(app))
  const db: Firestore = getFirestore(app)
  const colRef = (c: Col) => collection(db, 'families', familyCode, c)
  return {
    subscribe(c, cb) {
      return onSnapshot(colRef(c), (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))))
    },
    async put(c, item) {
      await setDoc(doc(colRef(c), item.id), clean(item))
    },
    async remove(c, id) {
      await deleteDoc(doc(colRef(c), id))
    },
  }
}
