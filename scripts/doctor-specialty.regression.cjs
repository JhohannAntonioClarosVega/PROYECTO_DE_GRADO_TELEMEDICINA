// Executes the real doctor dashboard with synthetic hooks, clock, auth and read services.
// The configured Supabase client, network and real patient records are never imported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const componentPath = path.resolve('app/(doctor)/dashboard.tsx');
const componentSource = fs.readFileSync(componentPath, 'utf8');
const doctorId = 'synthetic-doctor';
const specialtyA = 'Cardiología';
const specialtyB = 'Neurología';

function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function syntheticTriage(id, specialty = specialtyA) {
  return {
    id: `synthetic-triage-${id}`,
    patient_id: `synthetic-patient-${id}`,
    created_at: '2026-01-01T11:55:00.000Z',
    urgency_level: 'Low', status: 'pending',
    reported_symptoms: `Synthetic symptoms ${id}`,
    ai_raw_analysis: `Synthetic analysis ${id}`,
    recommended_specialty: specialty,
    patients: { profiles: { full_name: `Synthetic patient ${id}` } },
  };
}

const sampleQueue = () => [syntheticTriage('A'), syntheticTriage('B', specialtyB)];

class FakeDatabase {
  constructor({ respectAbort = false } = {}) {
    this.requests = [];
    this.channels = [];
    this.respectAbort = respectAbort;
    this.supabase = {
      auth: { getUser: () => this.request('auth').promise, signOut: () => { throw new Error('Logout is outside these checks'); } },
      from: table => {
        assert.ok(['profiles', 'doctors'].includes(table), `Unexpected table/write: ${table}`);
        const database = this;
        const details = { filters: [] };
        let request;
        return {
          select(columns) { details.columns = columns; return this; },
          eq(column, value) { details.filters.push({ column, value }); return this; },
          single() { return this; },
          maybeSingle() { return this; },
          abortSignal(signal) { details.signal = signal; return this; },
          then(yes, no) {
            request ||= database.request(table, details);
            return request.promise.then(yes, no);
          },
        };
      },
      channel: name => {
        const channel = {
          name, handlers: [], removed: false,
          on(type, filter, callback) { this.handlers.push({ type, filter, callback }); return this; },
          subscribe() { return this; },
          send() { throw new Error('No notifications/writes are part of these checks'); },
        };
        this.channels.push(channel);
        return channel;
      },
      removeChannel: channel => { channel.removed = true; return Promise.resolve('ok'); },
    };
    this.triageService = {
      getActiveTriages: signal => this.request('triages', { signal }).promise.then(result => {
        if (result.error) throw result.error;
        return result.data;
      }),
    };
  }
  request(kind, details = {}) {
    const response = deferred();
    const request = { kind, ...details, response, settled: false };
    request.promise = response.promise;
    request.resolve = result => { request.settled = true; response.resolve(result); };
    request.reject = error => { request.settled = true; response.reject(error); };
    this.requests.push(request);
    if (this.respectAbort && request.signal) {
      const onAbort = () => request.reject(Object.assign(new Error('Synthetic aborted read'), { name: 'AbortError' }));
      if (request.signal.aborted) onAbort();
      else request.signal.addEventListener('abort', onAbort, { once: true });
      const cleanup = () => request.signal.removeEventListener('abort', onAbort);
      request.promise.then(cleanup, cleanup);
    }
    return request;
  }
  calls(kind) { return this.requests.filter(request => request.kind === kind); }
  pending(kind) { return this.requests.filter(request => !request.settled && (!kind || request.kind === kind)); }
  answer(request, specialty = specialtyA, rows = sampleQueue(), overrides = {}) {
    const answers = {
      auth: { data: { user: { id: doctorId } }, error: null },
      profiles: { data: { full_name: 'Synthetic doctor' }, error: null },
      doctors: { data: { specialty_id: specialty === null ? null : `synthetic-specialty-${specialty}`, specialties: specialty === null ? null : { name: specialty } }, error: null },
      triages: { data: rows, error: null },
    };
    request.resolve(overrides[request.kind] || answers[request.kind]);
  }
  emit(channel = this.channels.find(value => !value.removed)) {
    assert.ok(channel, 'An existing triages subscription must be available');
    for (const handler of channel.handlers) handler.callback({ eventType: 'UPDATE', new: { id: 'synthetic-event' } });
  }
}

class DashboardHarness {
  constructor(database = new FakeDatabase(), source = componentSource) {
    this.database = database;
    this.hooks = [];
    this.cursor = 0;
    this.effects = [];
    this.mounted = true;
    this.dirty = false;
    this.time = 0;
    this.sequence = 0;
    this.timers = new Map();
    this.messages = [];
    this.alerts = [];
    this.navigation = [];
    this.lateStateUpdates = 0;
    this.renderCount = 0;
    const hook = factory => {
      const index = this.cursor++;
      if (!(index in this.hooks)) this.hooks[index] = factory();
      return this.hooks[index];
    };
    const same = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
    const react = {
      useState: initial => {
        const state = hook(() => ({ value: typeof initial === 'function' ? initial() : initial }));
        if (!state.set) state.set = value => {
          if (!this.mounted) { this.lateStateUpdates++; return; }
          const next = typeof value === 'function' ? value(state.value) : value;
          if (!Object.is(next, state.value)) { state.value = next; this.dirty = true; }
        };
        return [state.value, state.set];
      },
      useRef: value => hook(() => ({ current: value })),
      useCallback: (callback, dependencies) => {
        const state = hook(() => ({ callback, dependencies }));
        if (!same(state.dependencies, dependencies)) Object.assign(state, { callback, dependencies });
        return state.callback;
      },
      useEffectEvent: callback => {
        const state = hook(() => ({ callback }));
        state.callback = callback;
        state.event ||= (...args) => state.callback(...args);
        return state.event;
      },
      useEffect: (effect, dependencies) => {
        const state = hook(() => ({ effect, dependencies: undefined }));
        state.effect = effect;
        if (!same(state.dependencies, dependencies)) this.effects.push(() => {
          state.cleanup?.();
          state.dependencies = dependencies;
          state.cleanup = effect();
        });
      },
    };
    const jsx = (type, props, key) => ({ type, props: props || {}, key });
    const native = Object.fromEntries(['ActivityIndicator', 'FlatList', 'Modal', 'RefreshControl', 'ScrollView', 'Text', 'TouchableOpacity', 'View'].map(name => [name, name]));
    const dependencies = {
      react,
      'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
      'react-native': native,
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      'expo-router': { router: { push: destination => this.navigation.push(destination), replace: destination => this.navigation.push(destination) } },
      '@/services/triage.service': { triageService: database.triageService },
      '@/lib/supabase': { supabase: database.supabase },
      '@/components/CustomModal': { default: 'CustomModal', __esModule: true },
    };
    const componentModule = { exports: {} };
    vm.runInNewContext(compile(source), {
      module: componentModule, exports: componentModule.exports,
      AbortController, Date,
      alert: value => this.alerts.push(value),
      console: { error: (...values) => this.messages.push(values), warn: (...values) => this.messages.push(values), log: () => {} },
      setTimeout: (callback, duration) => this.addTimer(callback, duration, false),
      clearTimeout: id => this.timers.delete(id),
      setInterval: (callback, duration) => this.addTimer(callback, duration, true),
      clearInterval: id => this.timers.delete(id),
      require: name => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dashboard import: ${name}`);
        return dependencies[name];
      },
    }, { filename: componentPath });
    this.component = componentModule.exports.default;
    this.render();
  }
  render() {
    if (!this.mounted) return;
    this.dirty = false; this.cursor = 0; this.effects = []; this.renderCount++;
    this.tree = this.component();
    for (const effect of this.effects) effect();
    this.effects = [];
  }
  async settle() {
    for (let step = 0; step < 100; step++) {
      await Promise.resolve();
      if (this.mounted && this.dirty) this.render();
    }
    assert.equal(this.mounted && this.dirty, false, 'The real dashboard must settle without an effect/render loop');
  }
  addTimer(callback, duration, repeating) {
    const id = ++this.sequence;
    this.timers.set(id, { callback, due: this.time + duration, duration, repeating });
    return id;
  }
  async advance(duration) {
    const until = this.time + duration;
    let steps = 0;
    while (true) {
      const next = [...this.timers.entries()].filter(([, timer]) => timer.due <= until).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      assert.ok(++steps < 100, 'The dashboard must not create continuous timer requests');
      const [id, timer] = next; this.time = timer.due;
      if (timer.repeating) timer.due += timer.duration;
      else this.timers.delete(id);
      timer.callback(); await this.settle();
    }
    this.time = until; await this.settle();
  }
  nodes(tree) {
    if (arguments.length === 0) tree = this.tree;
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(item => this.nodes(item));
    const children = tree.type === 'Modal' && !tree.props.visible ? [] : this.nodes(tree.props?.children);
    return [tree, ...children];
  }
  text(tree) {
    if (arguments.length === 0) tree = this.tree;
    if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
    if (!tree || typeof tree !== 'object') return '';
    if (Array.isArray(tree)) return tree.map(item => this.text(item)).join(' ');
    if (tree.type === 'Modal' && !tree.props.visible) return '';
    return this.text(tree.props?.children || '');
  }
  get list() { return this.nodes().find(node => node.type === 'FlatList'); }
  get rows() { return this.list?.props.data || []; }
  get ids() { return Array.from(this.rows, row => row.id); }
  get spinner() { return this.nodes().some(node => node.type === 'ActivityIndicator'); }
  get error() { return this.nodes().find(node => node.props.accessibilityRole === 'alert'); }
  get detailModal() { return this.nodes().find(node => node.type === 'Modal'); }
  get refreshButton() {
    return this.nodes().find(node => node.type === 'TouchableOpacity' && this.nodes(node).some(child => child.type === 'Ionicons' && child.props.name === 'reload'));
  }
  async refresh() { assert.ok(this.refreshButton); this.refreshButton.props.onPress(); await this.settle(); }
  async retry() {
    const button = this.nodes().find(node => node.type === 'TouchableOpacity' && this.text(node).trim() === 'Reintentar');
    assert.ok(button, 'The load error must offer its existing retry action');
    button.props.onPress(); await this.settle();
  }
  async filter(enabled) {
    const button = this.nodes().find(node => node.type === 'TouchableOpacity' && (enabled ? /^Solo /.test(this.text(node)) : /^Todos \(/.test(this.text(node))));
    assert.ok(button, `The ${enabled ? 'specialty' : 'all'} filter must remain available`);
    button.props.onPress(); await this.settle();
  }
  async complete(specialty = specialtyA, rows = sampleQueue(), kinds = ['auth', 'profiles', 'doctors', 'triages'], overrides = {}) {
    for (let step = 0; step < 12; step++) {
      await this.settle();
      const pending = this.database.pending().filter(request => kinds.includes(request.kind));
      if (!pending.length) return;
      for (const request of pending) this.database.answer(request, specialty, rows, overrides);
    }
    assert.fail('A finite dashboard load must not continuously start new requests');
  }
  async openDetails() {
    assert.ok(this.list && this.rows.length);
    const rendered = this.list.props.renderItem({ item: this.rows[0] });
    const button = this.nodes(rendered).find(node => node.type === 'TouchableOpacity' && this.text(node).trim() === 'Detalles IA');
    assert.ok(button); button.props.onPress(); await this.settle();
  }
  replayEffects() {
    for (const hook of this.hooks) if (hook.cleanup) hook.cleanup();
    for (const hook of this.hooks) if (hook.effect) hook.cleanup = hook.effect();
  }
  unmount() {
    for (const hook of this.hooks) if (hook.cleanup) hook.cleanup();
    this.mounted = false; this.dirty = false;
  }
  assertClean() {
    assert.equal(this.timers.size, 0, 'Unmount must clear the load deadline');
    assert.equal(this.lateStateUpdates, 0, 'Late reads/events must not attempt state updates after unmount');
    assert.equal(this.database.channels.filter(channel => !channel.removed).length, 0, 'The existing Realtime channel must be removed');
  }
}

async function ready(source = componentSource, options) {
  const database = new FakeDatabase(options);
  const screen = new DashboardHarness(database, source);
  await screen.complete();
  assert.deepEqual(screen.ids, ['synthetic-triage-A']);
  return { database, screen };
}

async function checkSpecialtyChange(source = componentSource) {
  const { screen } = await ready(source);
  await screen.filter(true);
  await screen.complete(specialtyB);
  assert.match(screen.text(), /Especialidad: Neurología/, 'A mounted filter action must revalidate the current specialty');
  assert.deepEqual(screen.ids, ['synthetic-triage-B']);
  screen.unmount(); screen.assertClean();
}

async function run() {
  let passed = 0;
  async function scenario(name, body) { await body(); passed++; console.log(`PASS ${name}`); }

  await scenario('Initial specialty A and its queue commit together in one finite load', async () => {
    const { database, screen } = await ready();
    assert.match(screen.text(), /Especialidad: Cardiología/);
    for (const kind of ['auth', 'profiles', 'doctors', 'triages']) assert.equal(database.calls(kind).length, 1, `Mount must read ${kind} once`);
    assert.equal(screen.spinner, false); assert.equal(screen.error, undefined);
    assert.equal(database.channels.length, 1);
    assert.equal(database.channels[0].name, 'public:triages');
    screen.unmount(); screen.assertClean();
  });

  await scenario('A -> B while mounted is detected even by pressing the already selected specialty filter', checkSpecialtyChange);

  await scenario('Manual refresh revalidates specialty A -> B instead of reusing its stored value', async () => {
    const { database, screen } = await ready();
    await screen.refresh();
    assert.equal(screen.spinner, true); assert.equal(screen.list, undefined);
    await screen.complete(specialtyB);
    assert.match(screen.text(), /Especialidad: Neurología/); assert.deepEqual(screen.ids, ['synthetic-triage-B']);
    assert.equal(database.calls('doctors').length, 2); assert.equal(database.calls('triages').length, 2);
    screen.unmount(); screen.assertClean();
  });

  await scenario('The existing triages event revalidates specialty with the currently selected all filter', async () => {
    const { database, screen } = await ready();
    await screen.filter(false); await screen.complete();
    database.emit(); await screen.settle();
    assert.equal(screen.list, undefined);
    await screen.complete(specialtyB);
    assert.match(screen.text(), /Especialidad: Neurología/); assert.deepEqual(screen.ids, ['synthetic-triage-A', 'synthetic-triage-B']);
    assert.equal(database.channels.length, 1, 'Changing filters must not resubscribe or add specialty channels');
    screen.unmount(); screen.assertClean();
  });

  await scenario('Rapid filters coalesce into one final reload using the latest filter, without duplicate queue reads', async () => {
    const { database, screen } = await ready();
    await screen.filter(false);
    await screen.filter(true);
    await screen.filter(false);
    assert.equal(screen.list, undefined);
    assert.ok(database.calls('auth').length <= 2, 'Only one load may be outstanding while filters change');
    assert.equal(database.calls('triages').length, 1, 'An obsolete metadata load must not fetch its queue');
    await screen.complete(specialtyB);
    assert.deepEqual(screen.ids, ['synthetic-triage-A', 'synthetic-triage-B']);
    assert.match(screen.text(), /Especialidad: Neurología/);
    assert.equal(database.calls('triages').length, 2, 'Only the final revalidated load may fetch a queue');
    screen.unmount(); screen.assertClean();
  });

  await scenario('Changing the filter during a pending queue rejects that obsolete queue and loads the final specialty', async () => {
    const { database, screen } = await ready();
    await screen.refresh();
    await screen.complete(specialtyA, sampleQueue(), ['auth', 'profiles', 'doctors']);
    const old = database.pending('triages')[0]; assert.ok(old);
    await screen.filter(false); await screen.filter(true);
    database.answer(old, specialtyA); await screen.settle();
    assert.equal(screen.list, undefined, 'The obsolete result must not become visible between loads');
    await screen.complete(specialtyB);
    assert.deepEqual(screen.ids, ['synthetic-triage-B']);
    screen.unmount(); screen.assertClean();
  });

  await scenario('Loading hides old cards, old counts and the open clinical-detail modal', async () => {
    const { screen } = await ready();
    await screen.openDetails(); assert.equal(screen.detailModal.props.visible, true);
    await screen.refresh();
    assert.equal(screen.list, undefined); assert.equal(screen.detailModal.props.visible, false);
    assert.doesNotMatch(screen.text(), /Synthetic patient A/);
    assert.doesNotMatch(screen.text(), /Todos \(2\)/);
    await screen.complete(specialtyB);
    assert.deepEqual(screen.ids, ['synthetic-triage-B']);
    screen.unmount(); screen.assertClean();
  });

  for (const kind of ['auth', 'doctors']) {
    await scenario(`A ${kind} error blocks all queue exposure and a later refresh recovers`, async () => {
      const { database, screen } = await ready();
      await screen.refresh();
      if (kind === 'doctors') await screen.complete(specialtyA, sampleQueue(), ['auth', 'profiles']);
      const request = database.pending(kind)[0]; assert.ok(request);
      request.resolve(kind === 'auth'
        ? { data: { user: null }, error: { message: 'Synthetic authentication failure' } }
        : { data: null, error: { message: 'Synthetic specialty failure' } });
      await screen.complete(specialtyA, sampleQueue(), kind === 'auth' ? [] : ['profiles']);
      assert.equal(screen.spinner, false); assert.equal(screen.list, undefined);
      assert.ok(screen.error, 'Metadata failure must be observable rather than becoming a general queue');
      assert.equal(database.calls('triages').length, 1);
      await screen.refresh(); await screen.complete(specialtyB);
      assert.equal(screen.error, undefined); assert.deepEqual(screen.ids, ['synthetic-triage-B']);
      screen.unmount(); screen.assertClean();
    });
  }

  await scenario('A failed queue read hides stale data and permits recovery with the then-current specialty', async () => {
    const { database, screen } = await ready();
    await screen.refresh(); await screen.complete(specialtyB, sampleQueue(), ['auth', 'profiles', 'doctors']);
    database.pending('triages')[0].reject(new Error('Synthetic queue network failure'));
    await screen.settle();
    assert.equal(screen.spinner, false); assert.equal(screen.list, undefined); assert.ok(screen.error);
    await screen.refresh(); await screen.complete(specialtyB);
    assert.deepEqual(screen.ids, ['synthetic-triage-B']); assert.equal(screen.error, undefined);
    screen.unmount(); screen.assertClean();
  });

  await scenario('A legitimate missing specialty clears the old label and preserves the existing general-queue behavior', async () => {
    const { screen } = await ready();
    await screen.refresh(); await screen.complete(null);
    assert.doesNotMatch(screen.text(), /Cardiología/);
    assert.match(screen.text(), /Cola de espera general/);
    assert.deepEqual(screen.ids, ['synthetic-triage-A', 'synthetic-triage-B']);
    screen.unmount(); screen.assertClean();
  });

  const invalidAssignments = [
    ['assigned id with inaccessible relationship', { specialty_id: 'synthetic-assigned', specialties: null }],
    ['assigned id with empty relationship', { specialty_id: 'synthetic-assigned', specialties: [] }],
    ['assigned id with blank specialty name', { specialty_id: 'synthetic-assigned', specialties: { name: '   ' } }],
    ['missing assignment id', { specialties: { name: specialtyA } }],
    ['invalid assignment id type', { specialty_id: 42, specialties: { name: specialtyA } }],
    ['unassigned id with inconsistent named relationship', { specialty_id: null, specialties: { name: specialtyA } }],
  ];
  for (const [description, data] of invalidAssignments) {
    await scenario(`An ${description} fails closed and its retry revalidates specialty B`, async () => {
      const database = new FakeDatabase(); const screen = new DashboardHarness(database);
      await screen.complete(specialtyA, sampleQueue(), undefined, { doctors: { data, error: null } });
      assert.equal(screen.spinner, false); assert.equal(screen.list, undefined); assert.ok(screen.error);
      assert.equal(database.calls('triages').length, 0, 'Unverified assignments must never fetch/expose a general queue');
      await screen.retry(); await screen.complete(specialtyB);
      assert.equal(screen.error, undefined); assert.deepEqual(screen.ids, ['synthetic-triage-B']);
      screen.unmount(); screen.assertClean();
    });
  }

  await scenario('A valid assigned specialty relationship represented as an array retains the original support', async () => {
    const database = new FakeDatabase(); const screen = new DashboardHarness(database);
    await screen.complete(specialtyB, sampleQueue(), undefined, {
      doctors: { data: { specialty_id: 'synthetic-assigned', specialties: [{ name: specialtyB }] }, error: null },
    });
    assert.deepEqual(screen.ids, ['synthetic-triage-B']); assert.equal(screen.error, undefined);
    screen.unmount(); screen.assertClean();
  });

  await scenario('A missing authenticated user never starts profile, specialty or general queue reads', async () => {
    const database = new FakeDatabase(); const screen = new DashboardHarness(database);
    await screen.complete(specialtyA, sampleQueue(), undefined, { auth: { data: { user: null }, error: null } });
    assert.ok(screen.error); assert.equal(screen.list, undefined);
    for (const kind of ['profiles', 'doctors', 'triages']) assert.equal(database.calls(kind).length, 0);
    screen.unmount(); screen.assertClean();
  });

  await scenario('A missing doctor profile is an error instead of a general queue fallback', async () => {
    const database = new FakeDatabase(); const screen = new DashboardHarness(database);
    await screen.complete(specialtyA, sampleQueue(), undefined, { doctors: { data: null, error: null } });
    assert.ok(screen.error); assert.equal(screen.list, undefined); assert.equal(database.calls('triages').length, 0);
    screen.unmount(); screen.assertClean();
  });

  await scenario('Medicina General still sees the general queue and has no specialty filter chips', async () => {
    const database = new FakeDatabase(); const screen = new DashboardHarness(database);
    await screen.complete('Medicina General');
    assert.match(screen.text(), /Especialidad: Medicina General/);
    assert.deepEqual(screen.ids, ['synthetic-triage-A', 'synthetic-triage-B']);
    assert.doesNotMatch(screen.text(), /Solo Medicina General/);
    screen.unmount(); screen.assertClean();
  });

  await scenario('The original loose specialty matcher retains accents, prefixes and missing-recommendation behavior', async () => {
    const database = new FakeDatabase(); const screen = new DashboardHarness(database);
    const rows = [syntheticTriage('prefix', 'Pediatra'), syntheticTriage('accent', 'Pediatría'), syntheticTriage('missing', ''), syntheticTriage('other', specialtyA)];
    await screen.complete('Pediatría', rows);
    assert.deepEqual(screen.ids, ['synthetic-triage-prefix', 'synthetic-triage-accent', 'synthetic-triage-missing']);
    screen.unmount(); screen.assertClean();
  });

  for (const kind of ['auth', 'doctors', 'triages']) {
    await scenario(`Unmount during ${kind} ignores late responses and removed-channel callbacks`, async () => {
      const { database, screen } = await ready();
      await screen.refresh();
      if (kind !== 'auth') await screen.complete(specialtyA, sampleQueue(), ['auth', 'profiles']);
      if (kind === 'triages') await screen.complete(specialtyA, sampleQueue(), ['doctors']);
      const pending = database.pending(kind)[0]; assert.ok(pending);
      const channel = database.channels[0];
      screen.unmount();
      database.answer(pending, specialtyA); database.emit(channel);
      await screen.settle();
      assert.ok(!pending.signal || pending.signal.aborted, 'Cancelable reads must be aborted at cleanup');
      screen.assertClean();
    });
  }

  await scenario('Effect cleanup/restart rejects a former lifecycle response before the new lifecycle commits', async () => {
    const database = new FakeDatabase(); const screen = new DashboardHarness(database);
    await screen.settle();
    const old = database.pending('auth')[0];
    screen.replayEffects(); await screen.settle();
    const current = database.pending('auth').find(request => request !== old); assert.ok(current);
    database.answer(old, specialtyA); await screen.settle();
    assert.equal(database.calls('doctors').length, 0, 'The old lifecycle may not continue into metadata reads');
    await screen.complete(specialtyB);
    assert.deepEqual(screen.ids, ['synthetic-triage-B']);
    assert.equal(database.channels.filter(channel => !channel.removed).length, 1);
    screen.unmount(); screen.assertClean();
  });

  for (const outcome of ['resolve', 'reject']) {
    await scenario(`An expired queue's late ${outcome} cannot overwrite or unlock a newer load`, async () => {
      const { database, screen } = await ready();
      await screen.refresh(); await screen.complete(specialtyA, sampleQueue(), ['auth', 'profiles', 'doctors']);
      const old = database.pending('triages')[0]; assert.ok(old);
      await screen.advance(30000);
      assert.equal(screen.spinner, false); assert.ok(screen.error);
      await screen.refresh(); await screen.complete(specialtyB, sampleQueue(), ['auth', 'profiles', 'doctors']);
      const current = database.pending('triages').find(request => request !== old); assert.ok(current);
      if (outcome === 'resolve') database.answer(old, specialtyA);
      else old.reject(new Error('Synthetic old error'));
      await screen.settle();
      assert.equal(screen.spinner, true, 'An old finally must not release the newer loading state');
      assert.equal(screen.list, undefined);
      database.answer(current, specialtyB); await screen.settle();
      assert.deepEqual(screen.ids, ['synthetic-triage-B']); assert.equal(screen.error, undefined);
      screen.unmount(); screen.assertClean();
    });
  }

  await scenario('An old expired result arriving after B commits cannot restore A or its metadata', async () => {
    const { database, screen } = await ready();
    await screen.refresh(); await screen.complete(specialtyA, sampleQueue(), ['auth', 'profiles', 'doctors']);
    const old = database.pending('triages')[0];
    await screen.advance(30000); await screen.refresh();
    for (let step = 0; step < 8; step++) {
      for (const request of database.pending().filter(request => request !== old)) database.answer(request, specialtyB);
      await screen.settle();
    }
    assert.deepEqual(screen.ids, ['synthetic-triage-B']);
    database.answer(old, specialtyA); await screen.settle();
    assert.deepEqual(screen.ids, ['synthetic-triage-B']); assert.match(screen.text(), /Especialidad: Neurología/);
    screen.unmount(); screen.assertClean();
  });

  await scenario('Transport abort support releases a superseded read without exposing its obsolete data', async () => {
    const { database, screen } = await ready(componentSource, { respectAbort: true });
    await screen.refresh(); await screen.complete(specialtyA, sampleQueue(), ['auth', 'profiles', 'doctors']);
    const old = database.pending('triages')[0]; assert.ok(old);
    await screen.filter(false);
    assert.equal(old.signal.aborted, true);
    await screen.complete(specialtyB);
    assert.deepEqual(screen.ids, ['synthetic-triage-A', 'synthetic-triage-B']);
    assert.equal(screen.error, undefined);
    screen.unmount(); screen.assertClean();
  });

  await scenario('Idle time and ordinary rerenders do not poll, repeat reads or add subscriptions', async () => {
    const { database, screen } = await ready();
    const count = database.requests.length;
    screen.render(); await screen.settle(); await screen.advance(120000);
    assert.equal(database.requests.length, count);
    assert.equal(database.channels.length, 1); assert.equal(screen.timers.size, 0);
    screen.unmount(); screen.assertClean();
  });

  console.log(`Passed ${passed} isolated doctor-specialty scenarios (real TSX; synthetic hooks, auth, clock and services).`);
}

module.exports = { DashboardHarness, FakeDatabase, checkSpecialtyChange, run };
if (require.main === module) {
  const watchdog = setTimeout(() => {
    console.error('FAIL A synthetic scenario remained pending.');
    process.exit(1);
  }, 15000);
  run().then(() => clearTimeout(watchdog), error => {
    clearTimeout(watchdog); console.error(error); process.exitCode = 1;
  });
}
