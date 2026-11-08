// Isolated lifecycle diagnostics: executes the real screen with synthetic dependencies.
// This deliberately does not import the configured Supabase client or use a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const sourcePath = path.resolve('app/(patient)/waiting-room.tsx');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
}).outputText;

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function triage(id, status = 'waiting') {
  return {
    id, status, patient_id: `synthetic-patient-${id}`, urgency_level: 'Low',
    patients: { id: `synthetic-patient-${id}`, profiles: { full_name: `Synthetic ${id}` } },
  };
}

class FakeDatabase {
  constructor() {
    this.triages = new Map();
    this.appointments = new Map();
    this.channels = [];
    this.requests = [];
    this.overrides = [];
    this.latestId = null;
    this.authOverride = null;
    this.simulatedUpdate = null;
    this.writes = [];
    this.supabase = {
      auth: { getUser: () => this.authOverride || Promise.resolve({ data: { user: { id: 'synthetic-user' } } }) },
      from: table => this.query(table),
      channel: name => {
        const channel = {
          name, handlers: [], removed: false,
          on(type, filter, callback) { this.handlers.push({ type, filter, callback }); return this; },
          subscribe() { return this; },
        };
        this.channels.push(channel);
        return channel;
      },
      removeChannel: channel => { channel.removed = true; return Promise.resolve(); },
    };
  }

  query(table) {
    const database = this;
    const query = {
      table, filters: {},
      select() { return this; },
      eq(name, value) { this.filters[name] = value; return this; },
      in() { return this; },
      order() { return this; },
      limit() { return this; },
      maybeSingle() { return database.execute(this); },
      single() { return database.execute(this); },
      update(values) {
        if (!database.simulatedUpdate) throw new Error('Unexpected database write in isolated waiting-room diagnostics');
        this.updateValues = values;
        return this;
      },
      then(onFulfilled, onRejected) { return database.execute(this).then(onFulfilled, onRejected); },
    };
    return query;
  }

  execute(query) {
    const id = query.filters.id || query.filters.triage_id;
    if (query.updateValues) {
      assert.ok(this.simulatedUpdate, 'Writes must be explicitly enabled as in-memory fakes');
      this.writes.push({ table: query.table, id, values: query.updateValues });
      return this.simulatedUpdate;
    }
    this.requests.push({ table: query.table, id, filters: { ...query.filters } });
    const index = this.overrides.findIndex(item => item.table === query.table && item.id === id);
    if (index >= 0) return this.overrides.splice(index, 1)[0].response;
    let data = null;
    if (query.table === 'triages') data = this.triages.get(id || this.latestId) || null;
    if (query.table === 'appointments') data = this.appointments.get(id) || null;
    if (query.table === 'profiles') data = { id, full_name: 'Synthetic Doctor' };
    return Promise.resolve({ data, error: null });
  }

  deferNext(table, id) {
    const response = deferred();
    this.overrides.push({ table, id, response: response.promise });
    return response;
  }

  respondNext(table, id, response) {
    this.overrides.push({ table, id, response: Promise.resolve(response) });
  }

  channelFor(id) {
    return this.channels.findLast(channel => channel.name === `rt_waiting_${id}` && !channel.removed);
  }

  emit(channel, type, payload, table) {
    assert.ok(channel, 'Expected the screen to subscribe to its own channel');
    // Invoke even removed listeners to simulate a callback already queued before cleanup.
    for (const handler of channel.handlers) {
      if (handler.type === type && (!table || handler.filter.table === table)) handler.callback(payload);
    }
  }

  reads(id) {
    return this.requests.filter(item => item.table === 'triages' && item.id === id).length;
  }
}

class ScreenHarness {
  constructor(database, id) {
    this.database = database;
    this.params = id === undefined ? {} : { triageId: id };
    this.current = null;
    this.root = null;
    this.child = null;
    this.tree = null;
    this.dirty = false;
    this.mounted = true;
    this.time = 0;
    this.timerSequence = 0;
    this.timers = new Map();
    this.navigation = [];
    this.replacements = [];
    this.warnings = [];
    this.lateStateUpdates = 0;

    const hook = initial => {
      assert.ok(this.current, 'Hooks must run inside the screen');
      const instance = this.current;
      const index = instance.cursor++;
      if (!(index in instance.hooks)) instance.hooks[index] = initial();
      return [instance.hooks[index], instance];
    };
    const same = (before, after) => before && after && before.length === after.length && before.every((x, i) => Object.is(x, after[i]));
    const react = {
      useState: initial => {
        const [state, owner] = hook(() => ({ value: typeof initial === 'function' ? initial() : initial }));
        if (!state.set) state.set = next => {
          if (!owner.active) { this.lateStateUpdates++; return; }
          const value = typeof next === 'function' ? next(state.value) : next;
          if (!Object.is(value, state.value)) { state.value = value; this.dirty = true; }
        };
        return [state.value, state.set];
      },
      useRef: initial => hook(() => ({ current: initial }))[0],
      useCallback: (callback, dependencies) => {
        const [state] = hook(() => ({ callback, dependencies }));
        if (!same(state.dependencies, dependencies)) { state.callback = callback; state.dependencies = dependencies; }
        return state.callback;
      },
      useEffect: (effect, dependencies) => {
        const [state, owner] = hook(() => ({ dependencies: undefined }));
        if (!same(state.dependencies, dependencies)) {
          owner.effects.push(() => {
            if (state.cleanup) state.cleanup();
            state.dependencies = dependencies;
            state.cleanup = effect();
          });
        }
      },
      useEffectEvent: callback => {
        const [state] = hook(() => ({ callback }));
        state.callback = callback;
        if (!state.stable) state.stable = (...args) => state.callback(...args);
        return state.stable;
      },
    };
    const jsx = (type, props, key) => ({ type, props: props || {}, key });
    const native = Object.fromEntries([
      'ActivityIndicator', 'ScrollView', 'Text', 'TouchableOpacity', 'View',
    ].map(name => [name, name]));
    native.Platform = { OS: 'web' };
    native.StyleSheet = { create: styles => styles };
    const dependencies = {
      react,
      'react/jsx-runtime': { jsx, jsxs: jsx },
      'react-native': native,
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      'expo-router': {
        useLocalSearchParams: () => this.params,
        router: {
          push: destination => this.navigation.push(destination),
          replace: destination => this.replacements.push(destination),
        },
      },
      '@/lib/supabase': { supabase: database.supabase },
    };
    const module = { exports: {} };
    const context = {
      module, exports: module.exports,
      require: name => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected module import: ${name}`);
        return dependencies[name];
      },
      console: { warn: (...args) => this.warnings.push(args), error: (...args) => this.warnings.push(args), log() {} },
      setTimeout: (callback, duration) => this.addTimer(callback, duration, false),
      clearTimeout: idToClear => this.timers.delete(idToClear),
      setInterval: (callback, duration) => this.addTimer(callback, duration, true),
      clearInterval: idToClear => this.timers.delete(idToClear),
    };
    vm.runInNewContext(compiled, context, { filename: sourcePath });
    this.component = module.exports.default;
    this.root = this.instance(this.component, {});
    this.render();
  }

  instance(component, props, key) {
    return { component, props, key, cursor: 0, hooks: [], effects: [], active: true };
  }

  execute(instance) {
    instance.cursor = 0;
    instance.effects = [];
    this.current = instance;
    const tree = instance.component(instance.props);
    this.current = null;
    return tree;
  }

  cleanup(instance) {
    if (!instance) return;
    instance.active = false;
    for (const state of instance.hooks) if (state.cleanup) state.cleanup();
  }

  render() {
    if (!this.mounted) return;
    this.dirty = false;
    const outer = this.execute(this.root);
    if (typeof outer.type === 'function') {
      if (!this.child || this.child.key !== outer.key || this.child.component !== outer.type) {
        this.cleanup(this.child);
        this.child = this.instance(outer.type, outer.props, outer.key);
      }
      this.child.props = outer.props;
      this.tree = this.execute(this.child);
    } else {
      this.tree = outer;
    }
    for (const instance of [this.root, this.child].filter(Boolean)) {
      for (const effect of instance.effects) effect();
      instance.effects = [];
    }
  }

  async settle() {
    for (let turn = 0; turn < 80; turn++) {
      await Promise.resolve();
      if (this.dirty && this.mounted) this.render();
    }
    assert.equal(this.dirty && this.mounted, false, 'The screen must settle without a render loop');
  }

  async route(id) {
    this.params = id === undefined ? {} : { triageId: id };
    this.render();
    await this.settle();
  }

  addTimer(callback, duration, repeating) {
    const id = ++this.timerSequence;
    this.timers.set(id, { callback, due: this.time + duration, duration, repeating });
    return id;
  }

  async advance(duration) {
    const until = this.time + duration;
    let iterations = 0;
    while (true) {
      const next = [...this.timers.entries()].filter(([, timer]) => timer.due <= until)
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      assert.ok(++iterations < 100, 'Unexpected timer loop');
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
    if (Array.isArray(tree)) return tree.flatMap(node => this.nodes(node));
    return [tree, ...this.nodes(tree.props?.children)];
  }

  text(tree) {
    if (arguments.length === 0) tree = this.tree;
    if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
    if (!tree || typeof tree !== 'object') return '';
    if (Array.isArray(tree)) return tree.map(node => this.text(node)).join(' ');
    return this.text(tree.props?.children);
  }

  joinButton() {
    const button = this.nodes().find(node => node.type === 'TouchableOpacity' && /ENTRAR A LA CONSULTA|Aguardando al/.test(this.text(node)));
    assert.ok(button, `Expected waiting-room entry button; visible text: ${this.text()}`);
    return button;
  }

  timeouts() {
    return [...this.timers.values()].filter(timer => !timer.repeating).length;
  }

  unmount() {
    this.cleanup(this.child);
    this.cleanup(this.root);
    this.mounted = false;
    this.dirty = false;
  }
}

async function setup(id = 'B', status = 'waiting') {
  const database = new FakeDatabase();
  database.triages.set(id, triage(id, status));
  const screen = new ScreenHarness(database, id);
  await screen.settle();
  return { database, screen };
}

async function run() {
  let passed = 0;
  async function scenario(name, body) {
    await body();
    passed++;
    console.log(`PASS ${name}`);
  }

  await scenario('A ready -> B pending cancels A timer and ignores late A events; B needs its own fresh confirmation', async () => {
    const { database, screen } = await setup('A', 'in_progress');
    const oldChannel = database.channelFor('A');
    assert.equal(screen.joinButton().props.disabled, false);
    assert.equal(screen.timeouts(), 1);
    await screen.advance(400);
    database.triages.set('B', triage('B'));
    await screen.route('B');
    assert.equal(screen.timeouts(), 0);
    database.emit(oldChannel, 'broadcast', { payload: { triageId: 'A' } });
    await screen.advance(1600);
    assert.equal(screen.navigation.length, 0);
    assert.equal(screen.joinButton().props.disabled, true);
    database.triages.set('B', triage('B', 'in_progress'));
    database.emit(database.channelFor('B'), 'broadcast', { payload: { triageId: 'B' } });
    await screen.settle();
    assert.equal(screen.joinButton().props.disabled, false);
    const reads = database.reads('B');
    await screen.advance(1200);
    assert.equal(screen.navigation.length, 1);
    assert.equal(screen.navigation[0].params.triageId, 'B');
    assert.ok(database.reads('B') > reads, 'Navigation must perform a fresh status read');
    screen.unmount();
  });

  await scenario('Unmount before navigation timer cancels transition', async () => {
    const { database, screen } = await setup('B', 'in_progress');
    await screen.advance(400);
    screen.unmount();
    assert.equal(screen.timeouts(), 0);
    assert.equal(screen.timers.size, 0, 'Unmount must also cancel polling and visual intervals');
    assert.ok(database.channels.every(channel => channel.removed), 'Unmount must remove its Realtime channels');
    await screen.advance(3000);
    assert.equal(screen.navigation.length, 0);
    assert.equal(screen.lateStateUpdates, 0);
  });

  await scenario('Unmount during final status verification prevents navigation and late state updates', async () => {
    const { database, screen } = await setup('B', 'in_progress');
    const pending = database.deferNext('triages', 'B');
    await screen.advance(1200);
    screen.unmount();
    pending.resolve({ data: triage('B', 'in_progress'), error: null });
    await screen.settle();
    assert.equal(screen.navigation.length, 0);
    assert.equal(screen.lateStateUpdates, 0);
  });

  await scenario('Late A response cannot update B or a later A instance', async () => {
    const database = new FakeDatabase();
    database.triages.set('A', triage('A'));
    database.triages.set('B', triage('B'));
    const pending = database.deferNext('triages', 'A');
    const screen = new ScreenHarness(database, 'A');
    await screen.settle();
    await screen.route('B');
    await screen.route('A');
    pending.resolve({ data: triage('A', 'in_progress'), error: null });
    await screen.settle();
    await screen.advance(1500);
    assert.equal(screen.navigation.length, 0);
    assert.equal(screen.joinButton().props.disabled, true);
    assert.equal(screen.lateStateUpdates, 0);
    screen.unmount();
  });

  for (const status of ['waiting', 'completed', 'resolved']) {
    await scenario(`Fresh verification revokes earlier readiness when B is ${status}`, async () => {
      const { database, screen } = await setup('B', 'in_progress');
      database.triages.set('B', triage('B', status));
      await screen.advance(1200);
      assert.equal(screen.navigation.length, 0);
      assert.ok(!screen.nodes().some(node => node.type === 'TouchableOpacity' && node.props.disabled === false && /ENTRAR A LA CONSULTA/.test(screen.text(node))));
      screen.unmount();
    });
  }

  await scenario('Failed final verification blocks entry, reports the error, and permits later recovery', async () => {
    const { database, screen } = await setup('B', 'in_progress');
    database.respondNext('triages', 'B', { data: null, error: { message: 'Synthetic unavailable' } });
    await screen.advance(1200);
    assert.equal(screen.navigation.length, 0);
    assert.ok(screen.warnings.length > 0, 'Verification failure must be reported');
    database.emit(database.channelFor('B'), 'broadcast', { payload: { triageId: 'B' } });
    await screen.settle();
    await screen.advance(1200);
    assert.equal(screen.navigation.length, 1);
    assert.equal(screen.navigation[0].params.triageId, 'B');
    screen.unmount();
  });

  await scenario('Wrong triage identity in response or event cannot confirm B', async () => {
    const database = new FakeDatabase();
    database.triages.set('B', triage('B'));
    database.respondNext('triages', 'B', { data: triage('A', 'in_progress'), error: null });
    const screen = new ScreenHarness(database, 'B');
    await screen.settle();
    const reads = database.reads('B');
    database.emit(database.channelFor('B'), 'broadcast', { payload: { triageId: 'A' } });
    await screen.settle();
    assert.equal(database.reads('B'), reads, 'A mismatched broadcast must be ignored, not treated as confirmation');
    await screen.advance(1500);
    assert.equal(screen.navigation.length, 0);
    screen.unmount();
  });

  await scenario('Appointment confirmation must belong to the current triage', async () => {
    const { database, screen } = await setup('B');
    database.appointments.set('B', { id: 'synthetic-appointment', triage_id: 'A', doctor_id: 'synthetic-doctor', status: 'scheduled' });
    database.emit(database.channelFor('B'), 'postgres_changes', { new: { triage_id: 'B' } }, 'appointments');
    await screen.settle();
    await screen.advance(1500);
    assert.equal(screen.navigation.length, 0);
    database.appointments.set('B', { id: 'synthetic-appointment', triage_id: 'B', doctor_id: 'synthetic-doctor', status: 'scheduled' });
    database.emit(database.channelFor('B'), 'postgres_changes', { new: { triage_id: 'B' } }, 'appointments');
    await screen.settle();
    await screen.advance(1200);
    assert.equal(screen.navigation.length, 1);
    screen.unmount();
  });

  await scenario('Manual entry and automatic timer share a single final verification and navigation', async () => {
    const { database, screen } = await setup('B', 'in_progress');
    await screen.advance(1000);
    const pending = database.deferNext('triages', 'B');
    const reads = database.reads('B');
    screen.joinButton().props.onPress();
    await screen.settle();
    await screen.advance(200);
    assert.equal(database.reads('B'), reads + 1);
    pending.resolve({ data: triage('B', 'in_progress'), error: null });
    await screen.settle();
    assert.equal(screen.navigation.length, 1);
    screen.unmount();
  });

  await scenario('Slow polling coalesces pending reads and still settles after a response', async () => {
    const database = new FakeDatabase();
    database.triages.set('B', triage('B'));
    const pending = database.deferNext('triages', 'B');
    const screen = new ScreenHarness(database, 'B');
    await screen.settle();
    await screen.advance(6000);
    assert.equal(database.reads('B'), 1, 'Polling must not issue overlapping status reads');
    pending.resolve({ data: triage('B'), error: null });
    await screen.settle();
    assert.equal(screen.joinButton().props.disabled, true);
    assert.ok(!screen.text().includes('Cargando datos de tu consulta'));
    screen.unmount();
  });

  await scenario('Late fallback identity lookup cannot replace an explicit new route', async () => {
    const database = new FakeDatabase();
    database.latestId = 'A';
    database.triages.set('A', triage('A', 'in_progress'));
    database.triages.set('B', triage('B'));
    const auth = deferred();
    database.authOverride = auth.promise;
    const screen = new ScreenHarness(database, undefined);
    await screen.settle();
    await screen.route('B');
    auth.resolve({ data: { user: { id: 'synthetic-user' } } });
    await screen.settle();
    await screen.advance(1500);
    assert.equal(screen.navigation.length, 0);
    assert.equal(screen.joinButton().props.disabled, true);
    assert.equal(screen.lateStateUpdates, 0);
    screen.unmount();
  });

  await scenario('A delayed cancellation cannot redirect or overwrite the newer B screen', async () => {
    const { database, screen } = await setup('A');
    const pending = deferred();
    // The only write in this suite is an explicitly enabled, deferred in-memory fake.
    database.simulatedUpdate = pending.promise;
    const button = screen.nodes().find(node => node.type === 'TouchableOpacity' && /Cancelar y salir/.test(screen.text(node)));
    assert.ok(button);
    const cancellation = button.props.onPress();
    await screen.settle();
    assert.equal(database.writes.length, 1);
    assert.equal(database.writes[0].table, 'triages');
    assert.equal(database.writes[0].id, 'A');
    assert.equal(database.writes[0].values.status, 'resolved');
    database.triages.set('B', triage('B'));
    await screen.route('B');
    pending.resolve({ data: null, error: null });
    await cancellation;
    await screen.settle();
    assert.equal(screen.replacements.length, 0);
    assert.equal(screen.navigation.length, 0);
    assert.equal(screen.joinButton().props.disabled, true);
    assert.equal(screen.lateStateUpdates, 0);
    screen.unmount();
  });

  console.log(`\n${passed} isolated waiting-room scenarios passed. No browser or real service was used.`);
}

run().catch(error => { console.error(error); process.exitCode = 1; });
