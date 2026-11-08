// Executes the real monitor and read service with synthetic hooks, clock and Supabase.
// No configured Supabase client, network connection or real patient is imported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const componentPath = path.resolve('components/TriageMonitor.tsx');
const servicePath = path.resolve('services/triage.service.ts');
const componentSource = fs.readFileSync(componentPath, 'utf8');
const serviceSource = fs.readFileSync(servicePath, 'utf8');

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

function syntheticTriage(id) {
  return {
    id: `synthetic-triage-${id}`,
    patient_id: `synthetic-patient-${id}`,
    created_at: '2026-01-01T11:55:00.000Z',
    urgency_level: 'Low',
    reported_symptoms: `Synthetic symptoms ${id}`,
    patients: { profiles: { full_name: `Synthetic patient ${id}` } },
  };
}

class FakeDatabase {
  constructor({ respectAbort = false } = {}) {
    this.requests = [];
    this.pending = [];
    this.respectAbort = respectAbort;
    this.supabase = {
      from: table => {
        assert.equal(table, 'triages', 'The read must retain the original table');
        const request = { table, filters: [], orders: [], selections: [] };
        const database = this;
        return {
          select(value) { request.selections.push(value); return this; },
          gte(column, value) { request.filters.push({ operator: 'gte', column, value }); return this; },
          order(column, options) { request.orders.push({ column, ...options }); return this; },
          abortSignal(signal) { request.signal = signal; return this; },
          then(yes, no) {
            if (!request.promise) {
              const response = deferred();
              request.promise = response.promise;
              request.response = response;
              database.requests.push(request);
              database.pending.push(request);
              if (database.respectAbort && request.signal) {
                const onAbort = () => response.reject(Object.assign(new Error('Synthetic read aborted'), { name: 'AbortError' }));
                if (request.signal.aborted) onAbort();
                else request.signal.addEventListener('abort', onAbort, { once: true });
                const remove = () => request.signal.removeEventListener('abort', onAbort);
                response.promise.then(remove, remove);
              }
            }
            // Default mode ignores transport cancellation so stale-result barriers are exercised too.
            return request.promise.then(yes, no);
          },
        };
      },
    };
  }

  resolve(index, records) { this.requests[index].response.resolve({ data: records, error: null }); }
  fail(index, message = 'Synthetic network failure') { this.requests[index].response.reject(new Error(message)); }
  databaseError(index) { this.requests[index].response.resolve({ data: null, error: { message: 'Synthetic read rejection' } }); }
}

class MonitorHarness {
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
    const native = Object.fromEntries(['ActivityIndicator', 'RefreshControl', 'ScrollView', 'Text', 'TouchableOpacity', 'View'].map(name => [name, name]));
    native.Platform = { OS: 'web' };
    native.StatusBar = {};
    native.StyleSheet = { create: styles => styles };
    const harness = this;
    class FakeDate extends Date {
      constructor(...values) { super(...(values.length ? values : [Date.UTC(2026, 0, 1, 12) + harness.time])); }
      static now() { return Date.UTC(2026, 0, 1, 12) + harness.time; }
    }
    const environment = {
      Date: FakeDate, AbortController,
      console: {
        error: (...values) => this.messages.push(values),
        warn: (...values) => this.messages.push(values),
        log: () => {},
      },
      setTimeout: (callback, duration) => this.addTimer(callback, duration, false),
      clearTimeout: id => this.timers.delete(id),
      setInterval: (callback, duration) => this.addTimer(callback, duration, true),
      clearInterval: id => this.timers.delete(id),
    };
    const serviceModule = { exports: {} };
    vm.runInNewContext(compile(serviceSource), {
      ...environment, module: serviceModule, exports: serviceModule.exports,
      require: name => {
        assert.equal(name, '../lib/supabase', 'Service imports must stay isolated');
        return { supabase: database.supabase };
      },
    }, { filename: servicePath });
    this.service = serviceModule.exports.triageService;
    const dependencies = {
      react,
      'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
      'react-native': native,
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      'expo-router': { router: { push: destination => this.navigation.push(destination) } },
      '@/services/triage.service': { triageService: this.service },
    };
    const componentModule = { exports: {} };
    vm.runInNewContext(compile(source), {
      ...environment, module: componentModule, exports: componentModule.exports,
      require: name => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected monitor import: ${name}`);
        return dependencies[name];
      },
    }, { filename: componentPath });
    this.component = componentModule.exports.default;
    this.render();
  }

  render() {
    if (!this.mounted) return;
    this.dirty = false;
    this.cursor = 0;
    this.effects = [];
    this.renderCount++;
    this.tree = this.component();
    for (const effect of this.effects) effect();
    this.effects = [];
  }
  async settle() {
    for (let step = 0; step < 80; step++) {
      await Promise.resolve();
      if (this.mounted && this.dirty) this.render();
    }
    assert.equal(this.mounted && this.dirty, false, 'The real component must settle without a render loop');
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
      assert.ok(++steps < 100, 'The monitor must not create a timer loop');
      const [id, timer] = next;
      this.time = timer.due;
      if (timer.repeating) timer.due += timer.duration;
      else this.timers.delete(id);
      timer.callback();
      await this.settle();
    }
    this.time = until;
    await this.settle();
  }
  nodes(tree) {
    if (arguments.length === 0) tree = this.tree;
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(item => this.nodes(item));
    return [tree, ...this.nodes(tree.props?.children)];
  }
  text(tree) {
    if (arguments.length === 0) tree = this.tree;
    if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
    if (!tree || typeof tree !== 'object') return '';
    if (Array.isArray(tree)) return tree.map(item => this.text(item)).join(' ');
    return this.text(tree.props?.children || '');
  }
  get spinner() { return this.nodes().some(node => node.type === 'ActivityIndicator'); }
  get refreshControl() { return this.nodes().find(node => node.type === 'ScrollView').props.refreshControl.props; }
  get error() { return this.nodes().find(node => node.props.accessibilityRole === 'alert'); }
  async refresh(times = 1) {
    for (let index = 0; index < times; index++) this.refreshControl.onRefresh();
    await this.settle();
  }
  replayEffects() {
    // React StrictMode can clean up and restart effects without replacing refs/state.
    for (const hook of this.hooks) if (hook.cleanup) hook.cleanup();
    for (const hook of this.hooks) if (hook.effect) hook.cleanup = hook.effect();
  }
  unmount() {
    for (const hook of this.hooks) if (hook.cleanup) hook.cleanup();
    this.mounted = false;
    this.dirty = false;
  }
  assertClean() {
    assert.equal(this.timers.size, 0, 'Unmount must clear polling and timeout timers');
    assert.equal(this.lateStateUpdates, 0, 'Late reads must not attempt state updates after unmount');
  }
}

async function setup(source) {
  const database = new FakeDatabase();
  const screen = new MonitorHarness(database, source);
  await screen.settle();
  assert.equal(database.requests.length, 1, 'Mount must start one initial read');
  return { database, screen };
}

async function checkSlowResponse(source = componentSource) {
  const { database, screen } = await setup(source);
  await screen.advance(15000);
  assert.equal(database.requests.length, 1, 'Ticks during a slow read must share the pending request');
  database.resolve(0, [syntheticTriage('slow')]);
  await screen.settle();
  assert.match(screen.text(), /Synthetic patient slow/);
  assert.equal(screen.spinner, false);
  await screen.advance(5000);
  assert.equal(database.requests.length, 2, 'The original ten-second cadence must resume after completion');
  screen.unmount();
  screen.assertClean();
}

async function run() {
  let passed = 0;
  async function scenario(name, body) {
    await body();
    passed++;
    console.log(`PASS ${name}`);
  }

  await scenario('A response below ten seconds populates the real monitor and ends initial loading', async () => {
    const { database, screen } = await setup();
    assert.equal(screen.spinner, true);
    await screen.advance(5000);
    database.resolve(0, [syntheticTriage('fast')]);
    await screen.settle();
    assert.match(screen.text(), /Synthetic patient fast/);
    assert.match(screen.text(), /Synthetic symptoms fast/);
    assert.match(screen.text(), /Bajo/);
    assert.equal(screen.spinner, false);
    assert.equal(screen.refreshControl.refreshing, false);
    assert.equal(screen.error, undefined);
    screen.unmount(); screen.assertClean();
  });

  await scenario('A response above ten seconds is accepted without overlapping requests or starvation', checkSlowResponse);

  await scenario('Consecutive ten-second ticks retain each successful result and do not overlap', async () => {
    const { database, screen } = await setup();
    for (let index = 0; index < 4; index++) {
      assert.equal(database.requests.length, index + 1);
      database.resolve(index, [syntheticTriage(`update-${index}`)]);
      await screen.settle();
      assert.match(screen.text(), new RegExp(`Synthetic patient update-${index}`));
      if (index < 3) await screen.advance(10000);
    }
    assert.ok(screen.renderCount < 30, 'Repeated reads must not induce a render loop');
    screen.unmount(); screen.assertClean();
  });

  await scenario('Repeated manual refreshes and interval ticks coalesce while a read is pending', async () => {
    const { database, screen } = await setup();
    await screen.refresh(5);
    assert.equal(screen.refreshControl.refreshing, true);
    await screen.advance(20000);
    assert.equal(database.requests.length, 1);
    database.resolve(0, [syntheticTriage('manual')]);
    await screen.settle();
    assert.match(screen.text(), /Synthetic patient manual/);
    assert.equal(screen.refreshControl.refreshing, false);
    screen.unmount(); screen.assertClean();
  });

  await scenario('Initial network failure releases loading, reports the error and recovers on the next tick', async () => {
    const { database, screen } = await setup();
    database.fail(0);
    await screen.settle();
    assert.equal(screen.spinner, false);
    assert.equal(screen.refreshControl.refreshing, false);
    assert.ok(screen.error, 'A failed read must be visible instead of claiming the waiting room is empty');
    assert.doesNotMatch(screen.text(), /No hay pacientes|Todos los triajes han sido atendidos/);
    assert.ok(screen.messages.length > 0);
    await screen.advance(10000);
    database.resolve(1, [syntheticTriage('recovered')]);
    await screen.settle();
    assert.match(screen.text(), /Synthetic patient recovered/);
    assert.equal(screen.error, undefined);
    screen.unmount(); screen.assertClean();
  });

  await scenario('A failed manual refresh preserves the last valid list and can recover manually', async () => {
    const { database, screen } = await setup();
    database.resolve(0, [syntheticTriage('preserved')]);
    await screen.settle();
    await screen.refresh();
    database.databaseError(1);
    await screen.settle();
    assert.match(screen.text(), /Synthetic patient preserved/);
    assert.ok(screen.error);
    assert.equal(screen.refreshControl.refreshing, false);
    await screen.refresh();
    database.resolve(2, [syntheticTriage('new')]);
    await screen.settle();
    assert.match(screen.text(), /Synthetic patient new/);
    assert.doesNotMatch(screen.text(), /Synthetic patient preserved/);
    assert.equal(screen.error, undefined);
    screen.unmount(); screen.assertClean();
  });

  await scenario('An empty successful response clears the previous list without reporting a network error', async () => {
    const { database, screen } = await setup();
    database.resolve(0, [syntheticTriage('old')]);
    await screen.settle();
    await screen.advance(10000);
    database.resolve(1, []);
    await screen.settle();
    assert.match(screen.text(), /No hay pacientes en sala de espera/);
    assert.doesNotMatch(screen.text(), /Synthetic patient old/);
    assert.equal(screen.error, undefined);
    screen.unmount(); screen.assertClean();
  });

  for (const outcome of ['resolve', 'reject']) {
    await scenario(`Unmount aborts an outstanding read, clears timers and ignores its late ${outcome}`, async () => {
      const { database, screen } = await setup();
      await screen.refresh();
      const signal = database.requests[0].signal;
      assert.ok(signal instanceof AbortSignal);
      screen.unmount();
      assert.equal(signal.aborted, true);
      if (outcome === 'resolve') database.resolve(0, [syntheticTriage('obsolete')]);
      else database.fail(0);
      await screen.settle();
      screen.assertClean();
    });
  }

  await scenario('Effect cleanup/restart rejects the old lifecycle response and keeps the new request locked', async () => {
    const { database, screen } = await setup();
    screen.replayEffects();
    await screen.settle();
    assert.equal(database.requests.length, 2);
    assert.equal(database.requests[0].signal.aborted, true);
    database.resolve(0, [syntheticTriage('old-lifecycle')]);
    await screen.settle();
    assert.doesNotMatch(screen.text(), /Synthetic patient old-lifecycle/);
    await screen.advance(10000);
    assert.equal(database.requests.length, 2, 'An old finally handler must not unlock the new lifecycle read');
    database.resolve(1, [syntheticTriage('new-lifecycle')]);
    await screen.settle();
    assert.match(screen.text(), /Synthetic patient new-lifecycle/);
    screen.unmount(); screen.assertClean();
  });

  await scenario('A remounted monitor can show its own data while an old instance is still pending', async () => {
    const { database, screen: old } = await setup();
    old.unmount();
    const current = new MonitorHarness(database);
    await current.settle();
    database.resolve(1, [syntheticTriage('current-instance')]);
    await current.settle();
    database.resolve(0, [syntheticTriage('old-instance')]);
    await old.settle(); await current.settle();
    assert.match(current.text(), /Synthetic patient current-instance/);
    assert.doesNotMatch(current.text(), /Synthetic patient old-instance/);
    old.assertClean();
    current.unmount(); current.assertClean();
  });

  await scenario('Unmount before the read microtask runs prevents the real service from starting a request', async () => {
    const database = new FakeDatabase();
    const screen = new MonitorHarness(database);
    const detachedRefresh = screen.refreshControl.onRefresh;
    screen.unmount();
    detachedRefresh();
    await screen.settle();
    assert.equal(database.requests.length, 0);
    screen.assertClean();
  });

  await scenario('A previous effect lifecycle rejection cannot clear a newer lifecycle refresh or display an error', async () => {
    const { database, screen } = await setup();
    screen.replayEffects();
    await screen.settle();
    await screen.refresh();
    database.fail(0);
    await screen.settle();
    assert.equal(screen.refreshControl.refreshing, true);
    assert.equal(screen.error, undefined);
    database.resolve(1, [syntheticTriage('current-lifecycle')]);
    await screen.settle();
    assert.match(screen.text(), /Synthetic patient current-lifecycle/);
    screen.unmount(); screen.assertClean();
  });

  await scenario('A transport that honors AbortSignal rejects promptly during unmount without state updates', async () => {
    const database = new FakeDatabase({ respectAbort: true });
    const screen = new MonitorHarness(database);
    await screen.settle();
    assert.equal(database.requests.length, 1);
    screen.unmount();
    await screen.settle();
    assert.equal(database.requests[0].signal.aborted, true);
    assert.equal(screen.messages.length, 0, 'Expected transport cancellation must not be logged as a new network failure');
    screen.assertClean();
  });

  await scenario('A nonresponsive request times out at thirty seconds and does not block subsequent polling', async () => {
    const { database, screen } = await setup();
    await screen.refresh();
    await screen.advance(29999);
    assert.equal(database.requests.length, 1);
    assert.equal(database.requests[0].signal.aborted, false);
    assert.equal(screen.refreshControl.refreshing, true);
    await screen.advance(1);
    assert.equal(database.requests[0].signal.aborted, true);
    assert.equal(screen.refreshControl.refreshing, false);
    assert.equal(screen.spinner, false);
    assert.ok(screen.error);
    assert.doesNotMatch(screen.text(), /Todos los triajes han sido atendidos/);
    await screen.advance(10000);
    assert.equal(database.requests.length, 2);
    database.resolve(1, [syntheticTriage('after-timeout')]);
    await screen.settle();
    assert.match(screen.text(), /Synthetic patient after-timeout/);
    assert.equal(screen.error, undefined);
    screen.unmount(); screen.assertClean();
  });

  for (const outcome of ['resolve', 'reject']) {
    await scenario(`A timed-out request's late ${outcome} cannot overwrite or unlock a newer request`, async () => {
      const { database, screen } = await setup();
      await screen.advance(30000);
      await screen.refresh();
      assert.equal(database.requests.length, 2);
      if (outcome === 'resolve') database.resolve(0, [syntheticTriage('timed-out')]);
      else database.fail(0);
      await screen.settle();
      assert.doesNotMatch(screen.text(), /Synthetic patient timed-out/);
      assert.equal(screen.refreshControl.refreshing, true, 'Old completion must not clear the new refresh state');
      await screen.advance(10000);
      assert.equal(database.requests.length, 2, 'Old completion must not release the newer request lock');
      database.resolve(1, [syntheticTriage('latest')]);
      await screen.settle();
      assert.match(screen.text(), /Synthetic patient latest/);
      assert.equal(screen.refreshControl.refreshing, false);
      screen.unmount(); screen.assertClean();
    });
  }

  await scenario('Timeout after a previous success retains the last list until a fresh response arrives', async () => {
    const { database, screen } = await setup();
    database.resolve(0, [syntheticTriage('last-valid')]);
    await screen.settle();
    await screen.refresh();
    await screen.advance(30000);
    assert.match(screen.text(), /Synthetic patient last-valid/);
    assert.ok(screen.error);
    assert.equal(screen.refreshControl.refreshing, false);
    screen.unmount(); screen.assertClean();
  });

  await scenario('A transport abort rejection preserves the timeout message and allows automatic recovery', async () => {
    const database = new FakeDatabase({ respectAbort: true });
    const screen = new MonitorHarness(database);
    await screen.settle();
    await screen.advance(30000);
    assert.equal(database.requests[0].signal.aborted, true);
    assert.ok(screen.error);
    assert.match(screen.text(screen.error), /30 segundos/);
    assert.equal(screen.refreshControl.refreshing, false);
    assert.equal(screen.messages.length, 0, 'The timeout has its own UI notice; its abort rejection is not a second network error');
    await screen.advance(10000);
    assert.equal(database.requests.length, 2);
    database.resolve(1, [syntheticTriage('recovered-abort')]);
    await screen.settle();
    assert.match(screen.text(), /Synthetic patient recovered-abort/);
    assert.equal(screen.error, undefined);
    screen.unmount(); screen.assertClean();
  });

  await scenario('An expired read arriving after a newer successful result cannot overwrite that result', async () => {
    const { database, screen } = await setup();
    await screen.advance(30000);
    await screen.refresh();
    database.resolve(1, [syntheticTriage('newest')]);
    await screen.settle();
    database.resolve(0, [syntheticTriage('expired')]);
    await screen.settle();
    assert.match(screen.text(), /Synthetic patient newest/);
    assert.doesNotMatch(screen.text(), /Synthetic patient expired/);
    assert.equal(screen.error, undefined);
    screen.unmount(); screen.assertClean();
  });

  await scenario('The real read service preserves its join, last-day filter, order and optional signal contract', async () => {
    const { database, screen } = await setup();
    const initial = database.requests[0];
    assert.ok(initial.signal instanceof AbortSignal);
    assert.match(initial.selections[0], /patients/);
    assert.match(initial.selections[0], /profiles/);
    assert.match(initial.selections[0], /full_name/);
    assert.equal(initial.filters.length, 1);
    assert.equal(initial.filters[0].operator, 'gte');
    assert.equal(initial.filters[0].column, 'created_at');
    assert.equal(initial.filters[0].value, '2025-12-31T12:00:00.000Z');
    assert.equal(initial.orders.length, 1);
    assert.equal(initial.orders[0].column, 'created_at');
    assert.equal(initial.orders[0].ascending, false);
    const legacyRead = screen.service.getActiveTriages();
    await screen.settle();
    assert.equal(database.requests[1].signal, undefined, 'Other callers need not supply a signal');
    database.resolve(1, []);
    assert.deepEqual(await legacyRead, []);
    screen.unmount(); screen.assertClean();
  });

  await scenario('Patient evaluation navigation still receives the original triage payload', async () => {
    const { database, screen } = await setup();
    const raw = syntheticTriage('evaluate');
    database.resolve(0, [raw]);
    await screen.settle();
    const button = screen.nodes().find(node => node.type === 'TouchableOpacity' && /Evaluar Caso/.test(screen.text(node)));
    assert.ok(button);
    button.props.onPress();
    assert.equal(screen.navigation[0].pathname, '/evaluation');
    assert.deepEqual(JSON.parse(screen.navigation[0].params.data), raw);
    screen.unmount(); screen.assertClean();
  });

  console.log(`Passed ${passed} isolated triage-monitor scenarios (real TSX/service; synthetic hooks, clock and Supabase).`);
}

module.exports = { MonitorHarness, FakeDatabase, checkSlowResponse, syntheticTriage, run };
if (require.main === module) {
  const watchdog = setTimeout(() => {
    console.error('FAIL A synthetic scenario remained pending.');
    process.exit(1);
  }, 15000);
  run().then(() => clearTimeout(watchdog), error => {
    clearTimeout(watchdog);
    console.error(error);
    process.exitCode = 1;
  });
}
