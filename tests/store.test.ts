import test from 'node:test';
import assert from 'node:assert/strict';
import {
	createStore,
	defineStore,
	createContextStore,
	persist,
	history,
	createContext,
	useContext,
	createScope,
	effect,
	state,
	produce
} from '../src/core/index.ts';

test('createStore creates a lightweight reactive store with state and actions', () => {
	const useCounter = createStore<{ count: number; text: string }, { inc(): void; dec(): void; reset(): void }>((set) => ({
		count: 0,
		text: 'initial',
		inc: () => set(state => ({ count: state.count + 1 })),
		dec: () => set(state => ({ count: state.count - 1 })),
		reset: () => set({ count: 0, text: 'reset' })
	}));

	assert.equal(useCounter.getState().count, 0);
	assert.equal(useCounter.getState().text, 'initial');

	// Actions
	useCounter.getState().inc();
	assert.equal(useCounter.getState().count, 1);

	useCounter.getState().inc();
	assert.equal(useCounter.getState().count, 2);

	useCounter.getState().dec();
	assert.equal(useCounter.getState().count, 1);

	useCounter.getState().reset();
	assert.equal(useCounter.getState().count, 0);
	assert.equal(useCounter.getState().text, 'reset');
});

test('createStore supports fine-grained selector reactivity', () => {
	const useStore = createStore((set) => ({
		user: { name: 'Alice', age: 30 },
		preferences: { theme: 'dark' },
		setUserName: (name: string) => set(s => { s.user.name = name; }),
		setTheme: (theme: string) => set(s => { s.preferences.theme = theme; })
	}));

	let nameRuns = 0;
	let themeRuns = 0;
	let currentName = '';
	let currentTheme = '';

	createScope(() => {
		effect(() => {
			nameRuns++;
			currentName = useStore(s => s.user.name);
		}, { sync: true });

		effect(() => {
			themeRuns++;
			currentTheme = useStore(s => s.preferences.theme);
		}, { sync: true });
	});

	assert.equal(nameRuns, 1);
	assert.equal(themeRuns, 1);
	assert.equal(currentName, 'Alice');
	assert.equal(currentTheme, 'dark');

	// Changing only name must NOT trigger theme effect!
	useStore.getState().setUserName('Bob');
	assert.equal(nameRuns, 2);
	assert.equal(themeRuns, 1); // Granular: theme was untouched!
	assert.equal(currentName, 'Bob');

	// Changing only theme must NOT trigger name effect!
	useStore.getState().setTheme('light');
	assert.equal(nameRuns, 2); // Granular: name was untouched!
	assert.equal(themeRuns, 2);
	assert.equal(currentTheme, 'light');
});

test('defineStore defines a named atomic store', () => {
	const useAuth = defineStore('auth', (set) => ({
		token: null as string | null,
		login: (token: string) => set({ token }),
		logout: () => set({ token: null })
	}));

	assert.equal(useAuth.$id, 'auth');
	assert.equal(useAuth.getState().token, null);
	useAuth.getState().login('jwt-xyz');
	assert.equal(useAuth.getState().token, 'jwt-xyz');
	useAuth.getState().logout();
	assert.equal(useAuth.getState().token, null);
});

test('createContext and <Context.Provider> provide and read scoped context', () => {
	const ThemeContext = createContext<'light' | 'dark'>('light', { name: 'Theme' });

	// Default without provider
	assert.equal(ThemeContext.use(), 'light');
	assert.equal(useContext(ThemeContext), 'light');

	// Scoped with provide()
	const val = ThemeContext.provide('dark', () => {
		assert.equal(ThemeContext.use(), 'dark');
		assert.equal(useContext(ThemeContext), 'dark');
		return 42;
	});
	assert.equal(val, 42);

	// Context.Provider component
	createScope(() => {
		ThemeContext.Provider({ value: 'dark', children: null });
		assert.equal(ThemeContext.use(), 'dark');
	});
});

test('createContextStore provides isolated store instances per subtree', () => {
	interface TodoState {
		items: string[];
		add(item: string): void;
	}

	const [TodoProvider, useTodo] = createContextStore<{ items: string[]; add(item: string): void }, { initialItems?: string[] }>(
		(props) => createStore((set) => ({
			items: props.initialItems || [],
			add: (item: string) => set(s => { s.items.push(item); })
		})),
		{ name: 'Todo' }
	);

	// Instance 1
	createScope(() => {
		TodoProvider({ initialProps: { initialItems: ['A', 'B'] } });
		assert.deepEqual(useTodo(s => s.items), ['A', 'B']);
		useTodo().add('C');
		assert.deepEqual(useTodo(s => s.items), ['A', 'B', 'C']);
	});

	// Instance 2 (Isolated)
	createScope(() => {
		TodoProvider({ initialProps: { initialItems: ['X'] } });
		assert.deepEqual(useTodo(s => s.items), ['X']);
		useTodo().add('Y');
		assert.deepEqual(useTodo(s => s.items), ['X', 'Y']);
	});
});

test('persist middleware synchronizes state with custom storage', () => {
	const storageMap = new Map<string, string>();
	const mockStorage = {
		getItem: (k: string) => storageMap.get(k) || null,
		setItem: (k: string, v: string) => { storageMap.set(k, v); }
	};

	storageMap.set('settings-store', JSON.stringify({ volume: 80 }));

	const useSettings = createStore(
		persist<{ volume: number }, { setVolume(v: number): void }>(
			(set) => ({
				volume: 50,
				setVolume: (v: number) => set({ volume: v })
			}),
			{
				name: 'settings-store',
				storage: mockStorage
			}
		)
	);

	// Rehydrated from storage
	assert.equal(useSettings.getState().volume, 80);

	// Changes persist to storage
	useSettings.getState().setVolume(95);
	assert.equal(useSettings.getState().volume, 95);
	assert.equal(storageMap.get('settings-store'), JSON.stringify({ volume: 95 }));
});

test('history middleware provides undo, redo and time travel', () => {
	const useEditor = createStore(
		history<{ text: string }, { setText(t: string): void }>(
			(set) => ({
				text: 'v0',
				setText: (t: string) => set({ text: t })
			})
		)
	);

	assert.equal(useEditor.getState().text, 'v0');
	assert.equal(useEditor.getState().canUndo(), false);

	useEditor.getState().setText('v1');
	assert.equal(useEditor.getState().text, 'v1');
	assert.equal(useEditor.getState().canUndo(), true);
	assert.equal(useEditor.getState().canRedo(), false);

	useEditor.getState().setText('v2');
	assert.equal(useEditor.getState().text, 'v2');

	// Undo
	useEditor.getState().undo();
	assert.equal(useEditor.getState().text, 'v1');
	assert.equal(useEditor.getState().canRedo(), true);

	useEditor.getState().undo();
	assert.equal(useEditor.getState().text, 'v0');
	assert.equal(useEditor.getState().canUndo(), false);

	// Redo
	useEditor.getState().redo();
	assert.equal(useEditor.getState().text, 'v1');

	useEditor.getState().redo();
	assert.equal(useEditor.getState().text, 'v2');
	assert.equal(useEditor.getState().canRedo(), false);
});

test('state() and createStore support scalar primitives (number, float, string, boolean, bigint)', () => {
	// 1. Numeric scalar store
	const useCount = createStore<number>(10);
	assert.equal(useCount.getState(), 10);
	assert.equal(useCount(), 10);

	useCount.setState(25.5);
	assert.equal(useCount.getState(), 25.5);
	assert.equal(useCount(v => Math.floor(v)), 25);

	useCount.setState(prev => prev + 10);
	assert.equal(useCount.getState(), 35.5);

	// 2. String scalar store
	const useQuery = createStore<string>('lithe');
	assert.equal(useQuery.getState(), 'lithe');
	useQuery.setState('reactive');
	assert.equal(useQuery.getState(), 'reactive');
	assert.equal(useQuery(q => q.toUpperCase()), 'REACTIVE');

	// 3. Boolean flag store
	const useOpen = createStore<boolean>(false);
	assert.equal(useOpen.getState(), false);
	useOpen.setState(true);
	assert.equal(useOpen.getState(), true);
	useOpen.setState(prev => !prev);
	assert.equal(useOpen.getState(), false);

	// 4. Reactive state() with scalar
	const reactiveNum = state(42);
	assert.equal(reactiveNum.value, 42);
	reactiveNum.value = 100;
	assert.equal(reactiveNum.value, 100);
});

test('state() and createStore support Collections (Map, Set) and Built-ins (Date, TypedArray)', () => {
	// 1. Reactive Map
	const map = state(new Map<string, number>([['alpha', 1]]));
	let observedVal = 0;
	let observedSize = 0;

	createScope(() => {
		observedVal = map.get('alpha') || 0;
		observedSize = map.size;
	});

	assert.equal(observedVal, 1);
	assert.equal(observedSize, 1);

	map.set('beta', 2);
	assert.equal(map.size, 2);
	assert.equal(map.has('beta'), true);
	assert.equal(map.get('beta'), 2);

	map.delete('alpha');
	assert.equal(map.has('alpha'), false);
	assert.equal(map.size, 1);

	// 2. Reactive Set
	const set = state(new Set<string>(['item1']));
	assert.equal(set.has('item1'), true);
	assert.equal(set.size, 1);

	set.add('item2');
	assert.equal(set.has('item2'), true);
	assert.equal(set.size, 2);

	set.delete('item1');
	assert.equal(set.has('item1'), false);
	assert.equal(set.size, 1);

	// 3. Built-in Date
	const dateState = state({ timestamp: new Date('2026-01-01T00:00:00.000Z') });
	assert.equal(dateState.timestamp.getFullYear(), 2026);
	assert.equal(dateState.timestamp.toISOString(), '2026-01-01T00:00:00.000Z');

	// 4. Built-in Uint8Array
	const bytes = state({ buffer: new Uint8Array([1, 2, 3, 4]) });
	assert.equal(bytes.buffer.length, 4);
	assert.equal(bytes.buffer[0], 1);
	bytes.buffer[0] = 99;
	assert.equal(bytes.buffer[0], 99);
});

test('store supports spreading, deep patching, in-place mutations and produce()', () => {
	interface UserState {
		user: {
			name: string;
			age: number;
			profile: { bio: string; theme: string };
		};
		tags: string[];
		settings: { notifications: boolean; sound: boolean };
	}

	const useUserStore = createStore<UserState>({
		user: {
			name: 'Alice',
			age: 25,
			profile: { bio: 'Developer', theme: 'dark' }
		},
		tags: ['frontend', 'typescript'],
		settings: { notifications: true, sound: true }
	});

	// 1. Spreading proxy state
	const snapshot = { ...useUserStore.state };
	assert.equal(snapshot.user.name, 'Alice');
	assert.deepEqual(snapshot.tags, ['frontend', 'typescript']);

	// 2. Functional update with object spreading
	useUserStore.setState(s => ({
		...s,
		user: { ...s.user, age: 26 },
		tags: [...s.tags, 'lithe']
	}));
	assert.equal(useUserStore.getState().user.age, 26);
	assert.deepEqual(useUserStore.getState().tags, ['frontend', 'typescript', 'lithe']);

	// 3. Deep patching (store.patch)
	useUserStore.patch({
		user: {
			name: 'Alice Cooper',
			age: 26,
			profile: { bio: 'Lead Architect', theme: 'dark' }
		},
		settings: { sound: false, notifications: true }
	});
	assert.equal(useUserStore.getState().user.name, 'Alice Cooper');
	assert.equal(useUserStore.getState().user.age, 26); // preserved
	assert.equal(useUserStore.getState().user.profile.theme, 'dark'); // preserved
	assert.equal(useUserStore.getState().user.profile.bio, 'Lead Architect');
	assert.equal(useUserStore.getState().settings.notifications, true); // preserved
	assert.equal(useUserStore.getState().settings.sound, false);

	// 4. In-place produce mutation (store.mutate)
	useUserStore.mutate(draft => {
		draft.tags.push('signals');
		draft.user.profile.theme = 'solarized';
	});
	assert.deepEqual(useUserStore.getState().tags, ['frontend', 'typescript', 'lithe', 'signals']);
	assert.equal(useUserStore.getState().user.profile.theme, 'solarized');

	// 5. Direct proxy state mutations
	useUserStore.state.tags.pop();
	assert.deepEqual(useUserStore.getState().tags, ['frontend', 'typescript', 'lithe']);

	// 6. produce() helper
	const base = { count: 1, list: ['a'] };
	const next = produce(base, draft => {
		draft.count += 5;
		draft.list.push('b');
	});
	assert.deepEqual(base, { count: 1, list: ['a'] });
	assert.deepEqual(next, { count: 6, list: ['a', 'b'] });
});

test('store.patch ignores prototype pollution keys', () => {
	const useStore = createStore({ user: { name: 'Alice' }, ok: true });
	const payload = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"user":{"prototype":{"polluted":true},"name":"Bob"}}');

	useStore.patch(payload);

	assert.equal(useStore.getState().user.name, 'Bob');
	assert.equal(({} as any).polluted, undefined);
	assert.equal((useStore.getState() as any).polluted, undefined);
	assert.equal((useStore.getState().user as any).polluted, undefined);
});

test('store.setPath updates nested leaves and rejects unsafe keys', () => {
	const useStore = createStore({ user: { profile: { theme: 'dark' } } });
	let seen = '';

	createScope(() => {
		effect(() => {
			seen = useStore(s => s.user.profile.theme);
		}, { sync: true });
	});

	useStore.setPath(['user', 'profile', 'theme'], 'light');
	assert.equal(seen, 'light');
	assert.equal(useStore.getState().user.profile.theme, 'light');

	useStore.setPath(['__proto__', 'polluted'], true);
	assert.equal(({} as any).polluted, undefined);
});
